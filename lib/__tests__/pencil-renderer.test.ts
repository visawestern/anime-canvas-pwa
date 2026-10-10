import { describe, it, expect } from 'vitest';
import { svgPathToPoints, shouldAdvanceFrame, strokeStyleFor } from '@/lib/pencil-renderer';

describe('svgPathToPoints (M/L/C/Z subset for DrawingScript)', () => {
  it('parses M+L path', () => {
    expect(svgPathToPoints('M10 10 L40 40')).toEqual([
      [10, 10],
      [40, 40],
    ]);
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
    expect(() => svgPathToPoints('M0 0 Q5 5 10 10')).toThrow();
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
