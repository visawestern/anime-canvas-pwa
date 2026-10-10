import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('@/lib/pencil-renderer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/pencil-renderer')>();
  return { ...mod, playScriptOnCanvas: vi.fn(async () => {}) };
});

import { SceneComposer } from '@/components/SceneComposer';
import { saveEntity, listEntities, deleteEntity } from '@/lib/entities';
import { enqueuePaused } from '@/lib/scene-composer';
import type { DrawingScript } from '@/lib/drawing-script-schema';

const script = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['a'],
  steps: [{ id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 L10 10' }] }],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'x', dirtyLayers: [] },
} as unknown as DrawingScript;

describe('SceneComposer (cast + missing proposals + paused queue)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => script })) as never);
  });

  it('proposes to draw deleted cast and pauses the prompt without losing it', async () => {
    const aya = await saveEntity({ kind: 'character', name: 'Кей-П', script });
    render(<SceneComposer />);
    fireEvent.change(screen.getByLabelText(/промпт сцены/i), { target: { value: 'битва на мосту' } });
    fireEvent.click(await screen.findByRole('checkbox', { name: /Кей-П/ }));
    await deleteEntity(aya.id);
    fireEvent.click(screen.getByRole('button', { name: /собрать сцену/i }));

    await waitFor(() => expect(screen.getByTestId('missing-dialog')).toBeInTheDocument());
    const dlg = screen.getByTestId('missing-dialog');
    expect(within(dlg).getByText(/Кей-П/)).toBeInTheDocument();
    // prompt preserved in queue
    await waitFor(() => expect(screen.getByText('битва на мосту — на паузе')).toBeInTheDocument());
  });

  it('edits paused prompt and resumes generation after missing is drawn', async () => {
    await enqueuePaused({ prompt: 'встреча', characters: ['Нова-Р'], items: [], location: null });
    render(<SceneComposer />);
    // edit paused prompt
    const row = await screen.findByText('встреча — на паузе');
    const li = row.closest('li')!;
    fireEvent.click(within(li).getByRole('button', { name: /редактировать/i }));
    fireEvent.change(screen.getByLabelText(/редактировать промпт/i), { target: { value: 'встреча — ночь' } });
    fireEvent.click(within(li).getByRole('button', { name: /сохранить/i }));
    await waitFor(() => expect(screen.getByText('встреча — ночь — на паузе')).toBeInTheDocument());

    // draw the missing one, then resume
    await saveEntity({ kind: 'character', name: 'Нова-Р', script: script as never });
    const sceneScript = { ...script, layers: ['backdrop', 'actor_Нова-Р', 'ink', 'fill', 'shade'] };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => sceneScript })) as never);
    fireEvent.click(within(li).getByRole('button', { name: /продолжить/i }));
    await waitFor(() => expect(screen.getByText(/сцена готова/i)).toBeInTheDocument());
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.kind).toBe('scene');
    expect(body.prompt).toContain('встреча — ночь');
    expect(body.prompt).toContain('Нова-Р');
  });

  it('selects library cast via checkboxes and generates with it (no typing)', async () => {
    await saveEntity({ kind: 'character', name: 'Каст-Ая', script });
    const sceneScript = { ...script, layers: ['backdrop', 'actor_Каст-Ая', 'ink'] };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => sceneScript })) as never);
    render(<SceneComposer />);
    fireEvent.change(screen.getByLabelText(/промпт сцены/i), { target: { value: 'сцена с кастом' } });
    fireEvent.click(await screen.findByRole('checkbox', { name: /Каст-Ая/ }));
    fireEvent.click(screen.getByRole('button', { name: /собрать сцену/i }));
    await waitFor(() => expect(screen.getByText(/сцена готова/i)).toBeInTheDocument());
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.prompt).toContain('Каст-Ая');
  });

  it('scene template picker fills the prompt field', async () => {
    render(<SceneComposer />);
    fireEvent.change(screen.getByLabelText(/шаблон сцены/i), { target: { value: 'scene-duel-bridge' } });
    expect((screen.getByLabelText(/промпт сцены/i) as HTMLTextAreaElement).value).toContain('Кей');
  });

  it('remix uses the reference look and marks the scene basedOn (default template)', async () => {
    render(<SceneComposer />);
    fireEvent.click(screen.getByRole('button', { name: /изменить эталон/i }));
    expect((screen.getByLabelText(/промпт сцены/i) as HTMLTextAreaElement).value).toMatch(/^Измени эталон/);
    fireEvent.click(screen.getByRole('button', { name: /собрать сцену/i }));
    await waitFor(() => expect(screen.getByText(/сцена готова/i)).toBeInTheDocument());
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.prompt).toContain('Эталон');
    const scenes = await listEntities('scene');
    expect(scenes.some((s) => s.basedOn === 'anime-girl')).toBe(true);
  });

  it('generated scene plays in the preview canvas (visual proof, not just text)', async () => {
    render(<SceneComposer />);
    fireEvent.change(screen.getByLabelText(/промпт сцены/i), { target: { value: 'тихая сцена' } });
    fireEvent.click(screen.getByRole('button', { name: /собрать сцену/i }));
    await waitFor(() => expect(screen.getByTestId('film-stage')).toBeInTheDocument());
  });

  it('forks a scene keeping parent link', async () => {
    const s = await saveEntity({ kind: 'scene', name: 'Исходная', script: script as never });
    render(<SceneComposer />);
    await waitFor(() =>
      expect(screen.getAllByText(/Исходная/).some((el) => el.tagName === 'SPAN')).toBe(true),
    );
    const span = screen.getAllByText(/Исходная/).find((el) => el.tagName === 'SPAN')!;
    const li = span.closest('li')!;
    fireEvent.click(within(li).getByRole('button', { name: /форк/i }));
    await waitFor(() => expect(screen.getByText(new RegExp(s.id))).toBeInTheDocument());
  });
});
