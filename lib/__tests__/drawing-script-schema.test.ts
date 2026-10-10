import { describe, it, expect } from 'vitest';
import { DrawingScriptSchema } from '@/lib/drawing-script-schema';

const validScript = {
  style: { palette: ['#2b3a8f', '#9b5de5', '#fff5f7'], linePencil: '#6b7280', lineInk: '#14121f' },
  layers: ['construction', 'skeleton', 'head', 'face', 'hair_back', 'body', 'arms', 'magic', 'ink', 'fill', 'shade'],
  steps: [
    { id: 1, kind: 'pencil', layer: 'construction', label: 'Ось позы', strokes: [{ path: 'M10 10 C20 20 30 20 40 10', w: 1.2, o: 0.5 }], eraseAfter: true },
    { id: 2, kind: 'ink', layer: 'ink', label: 'Обводка', strokes: [{ path: 'M10 10 L40 40', w: 2 }] },
    { id: 3, kind: 'eraser', layer: 'construction', label: 'Стереть набросок' },
    { id: 4, kind: 'fill', layer: 'fill', fills: [{ path: 'M0 0 L10 0 L10 10 Z', color: '#fff5f7' }] },
  ],
  rig: { bones: [{ name: 'arm_L', from: [10, 20], to: [30, 40] }], morphTargets: ['hair_wave'] },
  anim: { fps: 12, loop: 'hair+magic', dirtyLayers: ['hair_back', 'magic'] },
};

describe('DrawingScriptSchema', () => {
  it('accepts a valid script from Gemma', () => {
    expect(() => DrawingScriptSchema.parse(validScript)).not.toThrow();
  });

  it('rejects unknown step kind (no silent simplification)', () => {
    expect(() =>
      DrawingScriptSchema.parse({
        ...validScript,
        steps: [{ id: 1, kind: 'generate_pixels' as never, layer: 'fill' }],
      }),
    ).toThrow();
  });

  it('rejects empty steps (must draw something)', () => {
    expect(() => DrawingScriptSchema.parse({ ...validScript, steps: [] })).toThrow();
  });

  it('rejects dirtyLayers outside layers list', () => {
    expect(() =>
      DrawingScriptSchema.parse({ ...validScript, anim: { fps: 12, loop: 'x', dirtyLayers: ['nope'] } }),
    ).toThrow();
  });

  it('clamps fps to anime range 1..24', () => {
    expect(() =>
      DrawingScriptSchema.parse({ ...validScript, anim: { fps: 60, loop: 'x', dirtyLayers: [] } }),
    ).toThrow();
  });
});
