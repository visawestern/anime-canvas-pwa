import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CastPicker } from '@/components/CastPicker';
import { saveEntity } from '@/lib/entities';

const script = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['construction', 'ink', 'fill'],
  steps: [
    { id: 1, kind: 'pencil', layer: 'construction', strokes: [{ path: 'M0 0 L10 10', w: 1.2, o: 0.5 }] },
    { id: 2, kind: 'ink', layer: 'ink', strokes: [{ path: 'M0 0 L10 10', w: 2.4, o: 1 }] },
    { id: 3, kind: 'fill', layer: 'fill', fills: [{ path: 'M0 0 L10 0 L10 10 Z', color: '#fff' }] },
  ],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'x', dirtyLayers: [] },
} as never;

describe('CastPicker (professional multi-select, no typing)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => script })) as never);
  });

  it('lists library cast as checkboxes and toggles selection', async () => {
    await saveEntity({ kind: 'character', name: 'Пик-Ая', script });
    const onChange = vi.fn();
    render(<CastPicker kind="character" selected={[]} onChange={onChange} />);
    const box = await screen.findByRole('checkbox', { name: /Пик-Ая/ });
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(['Пик-Ая']);
  });

  it('reflects pre-selected cast as checked', async () => {
    await saveEntity({ kind: 'character', name: 'Пик-Рин', script });
    render(<CastPicker kind="character" selected={['Пик-Рин']} onChange={() => {}} />);
    expect(await screen.findByRole('checkbox', { name: /Пик-Рин/ })).toBeChecked();
  });

  it('quick-add draws a new character inline and auto-selects it', async () => {
    const onChange = vi.fn();
    render(<CastPicker kind="character" selected={[]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/имя персонажа/i), { target: { value: 'Пик-Нова' } });
    fireEvent.change(screen.getByLabelText(/промпт персонажа/i), { target: { value: 'воин' } });
    fireEvent.click(screen.getByRole('button', { name: /нарисовать персонажа/i }));
    await waitFor(() => expect(screen.findByRole('checkbox', { name: /Пик-Нова/ })).resolves.toBeInTheDocument());
    expect(onChange).toHaveBeenCalledWith(['Пик-Нова']);
  });

  it('shows empty-state hint instead of an empty list', async () => {
    render(<CastPicker kind="item" selected={[]} onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText(/пока пусто/i)).toBeInTheDocument());
  });
});
