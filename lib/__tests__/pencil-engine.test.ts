import { describe, it, expect } from 'vitest';
import { interpolateStroke, applyJitter, FRAME_12FPS_MS } from '@/lib/pencil-engine';

describe('pencil-engine', () => {
  it('12fps frame budget equals ~83.33ms (limited anime animation)', () => {
    expect(FRAME_12FPS_MS).toBeCloseTo(1000 / 12, 5);
  });

  it('interpolates stroke points by progress 0..1', () => {
    const pts = [
      [0, 0],
      [10, 0],
      [10, 10],
    ] as const;
    expect(interpolateStroke(pts.map((p) => [...p] as [number, number]), 0)).toHaveLength(1);
    expect(interpolateStroke(pts.map((p) => [...p] as [number, number]), 1)).toHaveLength(3);
    const mid = interpolateStroke(pts.map((p) => [...p] as [number, number]), 0.5);
    expect(mid.length).toBeGreaterThanOrEqual(2);
  });

  it('clamps progress outside 0..1', () => {
    const pts: [number, number][] = [
      [0, 0],
      [5, 5],
    ];
    expect(interpolateStroke(pts, -1)).toHaveLength(1);
    expect(interpolateStroke(pts, 2)).toHaveLength(2);
  });

  it('jitter keeps stroke recognizable (max deviation bounded)', () => {
    const pts: [number, number][] = [
      [0, 0],
      [100, 100],
    ];
    const j = applyJitter(pts, 0.6, () => 0.5);
    expect(j[0][0]).toBeCloseTo(0 + 0.6 * (0.5 - 0.5) * 2, 5);
    for (const [x, y] of j) {
      expect(Math.abs(x)).toBeLessThanOrEqual(101);
      expect(Math.abs(y)).toBeLessThanOrEqual(101);
    }
  });
});
