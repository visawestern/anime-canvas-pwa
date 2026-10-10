import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocationPicker } from '@/components/LocationPicker';
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

describe('LocationPicker (single-select + quick-add)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => script })) as never);
  });

  it('selects exactly one location (radio)', async () => {
    await saveEntity({ kind: 'location', name: 'Лок-Храм', script });
    await saveEntity({ kind: 'location', name: 'Лок-Мост', script });
    const onChange = vi.fn();
    render(<LocationPicker selected={null} onChange={onChange} />);
    fireEvent.click(await screen.findByRole('radio', { name: /Лок-Мост/ }));
    expect(onChange).toHaveBeenCalledWith('Лок-Мост');
  });

  it('quick-add draws a new location and selects it', async () => {
    const onChange = vi.fn();
    render(<LocationPicker selected={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/имя места/i), { target: { value: 'Лок-Поляна' } });
    fireEvent.change(screen.getByLabelText(/промпт места/i), { target: { value: 'поляна' } });
    fireEvent.click(screen.getByRole('button', { name: /нарисовать место/i }));
    await waitFor(() => expect(screen.findByRole('radio', { name: /Лок-Поляна/ })).resolves.toBeInTheDocument());
    expect(onChange).toHaveBeenCalledWith('Лок-Поляна');
  });
});
