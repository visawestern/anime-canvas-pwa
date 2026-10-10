import { describe, it, expect } from 'vitest';
import { gradeOfStroke } from '@/lib/lesson-knowledge';
import { validatePipeline, validateSceneLayers } from '@/lib/lesson-pipeline';
import type { DrawingScript } from '@/lib/drawing-script-schema';

const good = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['construction', 'ink', 'fill'],
  steps: [
    { id: 1, kind: 'pencil', layer: 'construction', strokes: [{ path: 'M0 0 L10 10', w: 1.2, o: 0.5 }] },
    { id: 2, kind: 'ink', layer: 'ink', strokes: [{ path: 'M0 0 L10 10', w: 2.4, o: 1 }] },
    { id: 3, kind: 'fill', layer: 'fill', fills: [{ path: 'M0 0 L10 0 L10 10 Z', color: '#fff' }] },
  ],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'x', dirtyLayers: [] },
} as unknown as DrawingScript;

describe('gradeOfStroke (purmix HB->B6 bands)', () => {
  it('maps light thin strokes to HB and bold opaque to B6', () => {
    expect(gradeOfStroke({ w: 1.2, o: 0.5 })?.grade).toBe('HB');
    expect(gradeOfStroke({ w: 2.4, o: 1 })?.grade).toBe('B6');
    expect(gradeOfStroke({ w: 1.5, o: 0.7 })?.grade).toBe('B');
  });

  it('returns undefined outside all bands (impossible pencil)', () => {
    expect(gradeOfStroke({ w: 9, o: 1 })).toBeUndefined();
    expect(gradeOfStroke({ w: 1.2, o: 0.05 })).toBeUndefined();
  });
});

describe('validatePipeline (lessons as system gate)', () => {
  it('accepts a lesson-ordered script', () => {
    expect(validatePipeline(good)).toEqual([]);
  });

  it('rejects script not starting with construction', () => {
    const bad = { ...good, steps: [good.steps[1], good.steps[2]] };
    expect(validatePipeline(bad as DrawingScript).join(' ')).toMatch(/construction|pencil/i);
  });

  it('rejects script without ink (never finished)', () => {
    const bad = { ...good, steps: [good.steps[0], good.steps[2]] };
    expect(validatePipeline(bad as DrawingScript).join(' ')).toMatch(/ink/i);
  });

  it('rejects non-ascending step ids (film order broken)', () => {
    const bad = { ...good, steps: [good.steps[0], { ...good.steps[2], id: 1 }] };
    expect(validatePipeline(bad as DrawingScript).join(' ')).toMatch(/order|id/i);
  });

  it('rejects eraser over never-drawn layer', () => {
    const bad = {
      ...good,
      steps: [...good.steps, { id: 4, kind: 'eraser', layer: 'ghost', strokes: [{ path: 'M0 0 L1 1' }] }],
    };
    expect(validatePipeline(bad as unknown as DrawingScript).join(' ')).toMatch(/ghost|eras/i);
  });

  it('rejects strokes outside pencil grades', () => {
    const bad = {
      ...good,
      steps: [{ id: 1, kind: 'pencil', layer: 'construction', strokes: [{ path: 'M0 0 L1 1', w: 9, o: 1 }] }, good.steps[1]],
    };
    expect(validatePipeline(bad as unknown as DrawingScript).join(' ')).toMatch(/grade|B6|HB/i);
  });

  it('rejects empty fill step (draws nothing)', () => {
    const bad = { ...good, steps: [...good.steps.slice(0, 2), { id: 3, kind: 'fill', layer: 'fill' }] };
    expect(validatePipeline(bad as unknown as DrawingScript).join(' ')).toMatch(/fill/i);
  });

  it('accepts shade step with hatching strokes (purmix live case)', () => {
    const hatching = {
      ...good,
      steps: [
        ...good.steps.slice(0, 2),
        { id: 11, kind: 'shade', layer: 'shade', strokes: [{ path: 'M0 0 L10 10', w: 1.6, o: 0.7 }] },
      ],
    };
    expect(validatePipeline(hatching as unknown as DrawingScript)).toEqual([]);
  });

  it('exempts eraser strokes from grade bands (eraser size is not a pencil mark)', () => {
    const withEraser = {
      ...good,
      steps: [
        ...good.steps,
        { id: 4, kind: 'eraser', layer: 'construction', strokes: [{ path: 'M0 0 L5 5', w: 10, o: 1 }] },
      ],
    };
    expect(validatePipeline(withEraser as unknown as DrawingScript)).toEqual([]);
  });
});

describe('validateSceneLayers (every actor gets a layer)', () => {
  const scene = { ...good, layers: ['backdrop', 'actor_Нова', 'ink', 'fill', 'shade'] } as unknown as DrawingScript;

  it('passes when each cast member has an actor layer', () => {
    expect(validateSceneLayers(scene, ['Нова'])).toEqual([]);
  });

  it('lists actors without layers', () => {
    expect(validateSceneLayers(scene, ['Нова', 'Кей'])).toEqual(['Кей']);
  });

  it('empty cast is valid', () => {
    expect(validateSceneLayers(scene, [])).toEqual([]);
  });

  it('matches transliterated actor layers (live actor_aya case)', () => {
    const latin = { ...good, layers: ['backdrop', 'actor_aya', 'actor_kei', 'ink'] } as unknown as DrawingScript;
    expect(validateSceneLayers(latin, ['Ая', 'Кей'])).toEqual([]);
  });
});
