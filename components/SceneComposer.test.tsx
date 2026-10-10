import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { SceneComposer } from '@/components/SceneComposer';
import { saveEntity } from '@/lib/entities';

const script = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['a'],
  steps: [{ id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 L10 10' }] }],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'x', dirtyLayers: [] },
};

describe('SceneComposer (cast + missing proposals + paused queue)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => script })) as never);
  });

  it('proposes to draw missing cast and pauses the prompt without losing it', async () => {
    render(<SceneComposer />);
    fireEvent.change(screen.getByLabelText(/промпт сцены/i), { target: { value: 'битва на мосту' } });
    fireEvent.change(screen.getByLabelText(/персонажи/i), { target: { value: 'Ая, Кей' } });
    fireEvent.change(screen.getByLabelText(/предметы/i), { target: { value: 'Меч света' } });
    fireEvent.click(screen.getByRole('button', { name: /собрать сцену/i }));

    await waitFor(() => expect(screen.getByTestId('missing-dialog')).toBeInTheDocument());
    const dlg = screen.getByTestId('missing-dialog');
    expect(within(dlg).getByText(/Кей/)).toBeInTheDocument();
    // prompt preserved in queue
    await waitFor(() => expect(screen.getByText('битва на мосту — на паузе')).toBeInTheDocument());
  });

  it('edits paused prompt and resumes generation after missing is drawn', async () => {
    render(<SceneComposer />);
    fireEvent.change(screen.getByLabelText(/промпт сцены/i), { target: { value: 'встреча' } });
    fireEvent.change(screen.getByLabelText(/персонажи/i), { target: { value: 'Нова' } });
    fireEvent.click(screen.getByRole('button', { name: /собрать сцену/i }));
    await waitFor(() => expect(screen.getByTestId('missing-dialog')).toBeInTheDocument());

    // edit paused prompt
    const row = await screen.findByText('встреча — на паузе');
    const li = row.closest('li')!;
    fireEvent.click(within(li).getByRole('button', { name: /редактировать/i }));
    fireEvent.change(screen.getByLabelText(/редактировать промпт/i), { target: { value: 'встреча — ночь' } });
    fireEvent.click(within(li).getByRole('button', { name: /сохранить/i }));
    await waitFor(() => expect(screen.getByText('встреча — ночь — на паузе')).toBeInTheDocument());

    // draw the missing one, then resume
    await saveEntity({ kind: 'character', name: 'Нова', script: script as never });
    const sceneScript = { ...script, layers: ['backdrop', 'actor_Нова', 'ink', 'fill', 'shade'] };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => sceneScript })) as never);
    fireEvent.click(within(li).getByRole('button', { name: /продолжить/i }));
    await waitFor(() => expect(screen.getByText(/сцена готова/i)).toBeInTheDocument());
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.kind).toBe('scene');
    expect(body.prompt).toContain('встреча — ночь');
    expect(body.prompt).toContain('Нова');
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
