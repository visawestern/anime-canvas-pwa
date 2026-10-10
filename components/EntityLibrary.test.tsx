import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EntityLibrary } from '@/components/EntityLibrary';
import { saveEntity } from '@/lib/entities';

const script = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['a'],
  steps: [{ id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 L10 10' }] }],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'x', dirtyLayers: [] },
} as never;

describe('EntityLibrary', () => {
  it('lists entities of the kind and deletes on demand', async () => {
    await saveEntity({ kind: 'character', name: 'Библио-Герой', script });
    const onChange = vi.fn();
    render(<EntityLibrary kind="character" onChange={onChange} />);
    await waitFor(() => expect(screen.getByText(/Библио-Герой/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /удалить/i }));
    await waitFor(() => expect(screen.queryByText(/Библио-Герой/)).not.toBeInTheDocument());
    expect(onChange).toHaveBeenCalled();
  });
});
