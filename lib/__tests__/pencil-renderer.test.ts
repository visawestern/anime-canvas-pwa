import { describe, it, expect } from 'vitest';
import { svgPathToPoints, shouldAdvanceFrame, strokeStyleFor } from '@/lib/pencil-renderer';

describe('svgPathToPoints (M/L/C/Z subset for DrawingScript)', () => {
  it('parses M+L path', () => {
    expect(svgPathToPoints('M10 10 L40 40')).toEqual([
      [10, 10],
      [40, 40],
    ]);
  });

  it('parses H/V orthogonal lines (live model drift)', () => {
    expect(svgPathToPoints('M10 10 H40 V50 H10 Z')).toEqual([
      [10, 10],
      [40, 10],
      [40, 50],
      [10, 50],
      [10, 10],
    ]);
  });

  it('parses relative commands', () => {
    expect(svgPathToPoints('m10 10 l20 0 l0 20 z')).toEqual([
      [10, 10],
      [30, 10],
      [30, 30],
      [10, 10],
    ]);
  });

  it('parses implicit lineto pairs after moveto', () => {
    expect(svgPathToPoints('M10 10 20 20 30 10')).toEqual([
      [10, 10],
      [20, 20],
      [30, 10],
    ]);
  });

  it('parses smooth cubic S (reflected control point)', () => {
    const pts = svgPathToPoints('M0 0 C10 0 20 0 30 0 S50 0 60 0');
    expect(pts[0]).toEqual([0, 0]);
    const last = pts[pts.length - 1];
    expect(last[0]).toBeCloseTo(60, 0);
    expect(last[1]).toBeCloseTo(0, 0);
    expect(pts.length).toBeGreaterThan(4);
  });

  it('parses quadratic Q and smooth T', () => {
    const pts = svgPathToPoints('M0 0 Q10 10 20 0 T40 0');
    expect(pts[0]).toEqual([0, 0]);
    const last = pts[pts.length - 1];
    expect(last[0]).toBeCloseTo(40, 0);
    expect(last[1]).toBeCloseTo(0, 0);
  });

  it('parses arc A by endpoints with correct bulge', () => {
    const pts = svgPathToPoints('M0 0 A10 10 0 0 1 20 0');
    expect(pts[0]).toEqual([0, 0]);
    const last = pts[pts.length - 1];
    expect(last[0]).toBeCloseTo(20, 0);
    expect(last[1]).toBeCloseTo(0, 0);
    expect(Math.min(...pts.map((p) => p[1]))).toBeLessThan(0);
  });

  it('parses M+C cubic (sampled)', () => {
    const pts = svgPathToPoints('M0 0 C0 0 10 0 10 10');
    expect(pts.length).toBeGreaterThan(2);
    expect(pts[0]).toEqual([0, 0]);
    const last = pts[pts.length - 1];
    expect(last[0]).toBeCloseTo(10, 0);
    expect(last[1]).toBeCloseTo(10, 0);
  });

  it('closes Z path back to start', () => {
    const pts = svgPathToPoints('M0 0 L10 0 L10 10 Z');
    expect(pts[pts.length - 1]).toEqual([0, 0]);
  });

  it('throws on unsupported command (no silent skip)', () => {
    expect(() => svgPathToPoints('M0 0 Q5 5 10 10')).not.toThrow();
    expect(() => svgPathToPoints('M0 0 X10 10')).toThrow(/unsupported/);
  });
});

describe('shouldAdvanceFrame (12fps throttle)', () => {
  it('advances only after frame budget elapsed', () => {
    expect(shouldAdvanceFrame(100, 0, 12)).toBe(true);
    expect(shouldAdvanceFrame(50, 0, 12)).toBe(false);
  });
});

describe('strokeStyleFor (grade-aware pencil)', () => {
  it('HB construction is light gray, B6 press is near-ink dark', () => {
    const hb = strokeStyleFor('pencil', { w: 1.2, o: 0.5 });
    const b6 = strokeStyleFor('pencil', { w: 2.4, o: 1 });
    expect(hb).toMatch(/107,114,128/);
    expect(b6).not.toBe(hb);
    expect(b6).toMatch(/20,18,31/);
  });

  it('ink is always dark regardless of grade', () => {
    expect(strokeStyleFor('ink', { w: 1.2, o: 0.5 })).toBe('#14121f'); // rgb(20,18,31)
  });

  it('ungradable stroke falls back to neutral gray (never invisible)', () => {
    const s = strokeStyleFor('pencil', { w: 9, o: 1 });
    expect(s).toMatch(/rgba\(/);
  });
});
