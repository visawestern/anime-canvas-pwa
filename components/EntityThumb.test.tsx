import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/pencil-renderer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/pencil-renderer')>();
  return { ...mod, renderScriptStatic: vi.fn(() => ({ skipped: 0 })) };
});

import { EntityThumb } from '@/components/EntityThumb';
import { renderScriptStatic } from '@/lib/pencil-renderer';

const script = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['a'],
  steps: [{ id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 L10 10', w: 1.2, o: 0.5 }] }],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'x', dirtyLayers: [] },
} as never;

describe('EntityThumb (library avatar)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the script instantly into a small canvas', () => {
    render(<EntityThumb script={script} size={96} />);
    const canvas = screen.getByTestId('entity-thumb');
    expect(canvas.tagName).toBe('CANVAS');
    expect(canvas).toHaveAttribute('width', '96');
    expect(renderScriptStatic).toHaveBeenCalledTimes(1);
    const steps = vi.mocked(renderScriptStatic).mock.calls[0][1] as unknown[];
    expect(steps).toHaveLength(1);
    expect(vi.mocked(renderScriptStatic).mock.calls[0][2]).toMatchObject({ simplify: 1.5 });
  });
});
