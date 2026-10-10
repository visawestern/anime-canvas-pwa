import { describe, it, expect } from 'vitest';
import { simplifyPath, trimPoints } from '@/lib/path-surgery';
import type { Point } from '@/lib/pencil-engine';

describe('simplifyPath (Ramer–Douglas–Peucker: fix wobbly points)', () => {
  it('keeps endpoints and drops collinear middles', () => {
    const pts: Point[] = [
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 0],
    ];
    expect(simplifyPath(pts, 1)).toEqual([
      [0, 0],
      [30, 0],
    ]);
  });

  it('keeps real corners (no over-smoothing)', () => {
    const pts: Point[] = [
      [0, 0],
      [50, 1],
      [100, 0],
      [100, 100],
    ];
    const out = simplifyPath(pts, 1);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([100, 100]);
    expect(out.length).toBeGreaterThan(2);
  });

  it('passes through tiny polylines untouched', () => {
    expect(simplifyPath([], 1)).toEqual([]);
    expect(simplifyPath([[5, 5]], 1)).toEqual([[5, 5]]);
  });
});

describe('trimPoints (delete stale ranges, e.g. old animation tail)', () => {
  it('cuts a closed range out of a stroke', () => {
    const pts: Point[] = [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ];
    expect(trimPoints(pts, 1, 2)).toEqual([
      [0, 0],
      [3, 3],
    ]);
  });

  it('clamps out-of-range bounds instead of crashing', () => {
    const pts: Point[] = [
      [0, 0],
      [1, 1],
    ];
    expect(trimPoints(pts, -5, 99)).toEqual([]);
    expect(trimPoints(pts, 1, 0)).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });
});
