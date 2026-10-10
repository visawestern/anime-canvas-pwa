import { describe, it, expect } from 'vitest';
import { orderSteps } from '@/lib/pencil-renderer';
import type { DrawingScript } from '@/lib/drawing-script-schema';

function scriptWith(ids: number[]): DrawingScript {
  return {
    style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
    layers: ['a'],
    steps: ids.map((id) => ({ id, kind: 'pencil' as const, layer: 'a', strokes: [] })),
    rig: { bones: [], morphTargets: [] },
    anim: { fps: 12, loop: 'x', dirtyLayers: [] },
  };
}

describe('orderSteps', () => {
  it('plays steps strictly by id (film order, no shuffle)', () => {
    expect(orderSteps(scriptWith([3, 1, 2])).map((s) => s.id)).toEqual([1, 2, 3]);
  });
});
