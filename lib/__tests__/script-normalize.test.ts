import { describe, it, expect } from 'vitest';
import { normalizeScript } from '@/lib/script-normalize';

describe('normalizeScript (model drift -> canonical DrawingScript)', () => {
  it('passes through an already-canonical script with no warnings', () => {
    const canonical = {
      style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
      layers: ['construction', 'ink'],
      steps: [{ id: 1, kind: 'pencil', layer: 'construction', strokes: [{ path: 'M0 0 L10 10', w: 1.2, o: 0.5 }] }],
      rig: { bones: [], morphTargets: [] },
      anim: { fps: 12, loop: 'idle', dirtyLayers: [] },
    };
    const { script, warnings } = normalizeScript(canonical);
    expect(warnings).toEqual([]);
    expect(script).toEqual(canonical);
  });

  it('repairs the exact drift from the live error: style objects, missing ids/paths, bones, loop', () => {
    const drifted = {
      style: {
        palette: { hair: '#2b3a8f', skin: '#fff5f7' },
        linePencil: { color: '#6b7280', width: 1.2 },
        lineInk: { color: '#14121f', width: 2.4 },
      },
      layers: ['construction', 'ink', 'fill'],
      steps: [
        { kind: 'pencil', layer: 'construction', strokes: [{ d: 'M0 0 L10 10', w: 1.2, o: 0.5 }] },
        { n: 2, kind: 'ink', layer: 'ink', strokes: [{ points: [[0, 0], [10, 10]], w: 2.4, o: 1 }] },
        { id: 3, kind: 'fill', layer: 'fill', fills: [{ path: 'M0 0 L10 0 L10 10 Z', color: '#fff' }] },
      ],
      rig: {
        bones: [
          { joint: 'arm_L', start: [10, 20], end: [30, 40] },
          { name: 'arm_R', from: [10, 20], to: [30, 40] },
        ],
        morphTargets: { hair: 'wave' },
      },
      anim: { fps: 12, loop: true, dirtyLayers: [] },
    };
    const { script, warnings } = normalizeScript(drifted);
    const s = script as Record<string, unknown>;
    expect((s.style as Record<string, unknown>).palette).toEqual(['#2b3a8f', '#fff5f7']);
    expect((s.style as Record<string, unknown>).linePencil).toBe('#6b7280');
    const steps = s.steps as Record<string, unknown>[];
    expect(steps[0].id).toBe(1);
    expect(steps[1].id).toBe(2);
    expect(((steps[0].strokes as Record<string, unknown>[])[0]).path).toBe('M0 0 L10 10');
    expect(((steps[1].strokes as Record<string, unknown>[])[0]).path).toBe('M0 0 L10 10');
    const bones = ((s.rig as Record<string, unknown>).bones as Record<string, unknown>[]);
    expect(bones[0]).toMatchObject({ name: 'arm_L', from: [10, 20], to: [30, 40] });
    expect((s.rig as Record<string, unknown>).morphTargets).toEqual(['wave']);
    expect((s.anim as Record<string, unknown>).loop).toBe('idle');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.join(' ')).toMatch(/palette|id|path|loop/i);
  });

  it('drops strokes with no drawable geometry but records it (never silent)', () => {
    const { script, warnings } = normalizeScript({
      style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
      layers: ['a'],
      steps: [{ id: 1, kind: 'pencil', layer: 'a', strokes: [{ w: 1.2 }, { path: 'M0 0 L1 1' }] }],
      rig: { bones: [], morphTargets: [] },
      anim: { fps: 12, loop: 'x', dirtyLayers: [] },
    });
    const steps = (script as Record<string, unknown>).steps as Record<string, unknown>[];
    expect((steps[0].strokes as unknown[]).length).toBe(1);
    expect(warnings.join(' ')).toMatch(/drop/i);
  });

  it('throws on non-object input (no fake script from garbage)', () => {
    expect(() => normalizeScript(null)).toThrow();
    expect(() => normalizeScript('just text')).toThrow();
    expect(() => normalizeScript([1, 2])).toThrow();
  });
});
