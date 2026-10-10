import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CanvasStage } from '@/components/CanvasStage';

vi.mock('@/lib/pencil-renderer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/pencil-renderer')>();
  return { ...mod, playScriptOnCanvas: vi.fn(async () => {}) };
});
vi.mock('@/lib/cel-engine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/cel-engine')>();
  return { ...mod, startCelLoop: vi.fn(async () => ({ stop: () => {} })) };
});
vi.mock('@/lib/library-store', () => ({
  saveScript: vi.fn(async () => {}),
  loadScript: vi.fn(async () => undefined),
  listScripts: vi.fn(async () => []),
}));

import { playScriptOnCanvas } from '@/lib/pencil-renderer';
import { startCelLoop } from '@/lib/cel-engine';

const script = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['construction', 'ink', 'magic'],
  steps: [{ id: 1, kind: 'pencil', layer: 'construction', label: 'Ось', strokes: [{ path: 'M0 0 L10 10' }] }],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'm', dirtyLayers: ['magic'] },
};

function uploadFile() {
  const input = screen.getByLabelText(/загрузить фото/i) as HTMLInputElement;
  const file = new File(['x'], 'photo.png', { type: 'image/png' });
  // jsdom FileReader is async-empty; stub fileToBase64 path via readAsDataURL override
  const orig = (window as unknown as { FileReader: typeof FileReader }).FileReader;
  class FR {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL() {
      this.result = 'data:image/png;base64,AAA';
      setTimeout(() => this.onload?.(), 0);
    }
  }
  vi.stubGlobal('FileReader', FR);
  fireEvent.change(input, { target: { files: [file] } });
  return () => vi.stubGlobal('FileReader', orig);
}

describe('CanvasStage flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => script })) as never);
  });

  it('uploads photo, plays pencil film, lists steps', async () => {
    render(<CanvasStage />);
    const restore = uploadFile();
    await waitFor(() => expect(playScriptOnCanvas).toHaveBeenCalled());
    expect(screen.getByTestId('stage-status').textContent).toMatch(/карандаш|Готово|Шаг/i);
    expect(screen.getByText(/pencil: Ось/)).toBeInTheDocument();
    restore();
  });

  it('shows server error honestly (no fake drawing)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'ollama unavailable: down' }) })) as never);
    render(<CanvasStage />);
    const restore = uploadFile();
    await waitFor(() => expect(screen.getByTestId('stage-status').textContent).toMatch(/ollama unavailable/i));
    expect(playScriptOnCanvas).not.toHaveBeenCalled();
    restore();
  });

  it('ignores empty file selection (no fake request)', async () => {
    const fetchMock = vi.mocked(fetch);
    render(<CanvasStage />);
    const input = screen.getByLabelText(/загрузить фото/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('undo replays the previous artwork from history (no new commit)', async () => {
    const scriptA = { ...script, steps: [{ id: 1, kind: 'pencil', layer: 'a', label: 'A', strokes: [] }] };
    const scriptB = { ...script, steps: [{ id: 1, kind: 'pencil', layer: 'a', label: 'B', strokes: [] }] };
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => scriptA } as never)
      .mockResolvedValueOnce({ ok: true, json: async () => scriptB } as never);
    render(<CanvasStage />);
    const input = screen.getByLabelText(/загрузить фото/i) as HTMLInputElement;
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(playScriptOnCanvas).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(playScriptOnCanvas).toHaveBeenCalledTimes(2));
    // undo -> replay of A (3rd play call carries A's steps)
    fireEvent.click(screen.getByRole('button', { name: /^отменить$/i }));
    await waitFor(() => expect(playScriptOnCanvas).toHaveBeenCalledTimes(3));
    const lastArgs = vi.mocked(playScriptOnCanvas).mock.calls[2];
    expect(JSON.stringify(lastArgs[1])).toContain('"label":"A"');
    // history log shows both loads + current marker moved
    expect(screen.getByTestId('history-log').textContent).toContain('load:');
    // redo -> replay of B
    fireEvent.click(screen.getByRole('button', { name: /^переделать$/i }));
    await waitFor(() => expect(playScriptOnCanvas).toHaveBeenCalledTimes(4));
    expect(JSON.stringify(vi.mocked(playScriptOnCanvas).mock.calls[3][1])).toContain('"label":"B"');
  });

  it('animate button starts cel loop after script loaded', async () => {
    render(<CanvasStage />);
    const restore = uploadFile();
    await waitFor(() => expect(playScriptOnCanvas).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /анимировать/i }));
    await waitFor(() => expect(startCelLoop).toHaveBeenCalled());
    restore();
  });
});
