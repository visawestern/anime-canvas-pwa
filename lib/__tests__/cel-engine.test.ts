import { describe, it, expect } from 'vitest';
import { shouldRedrawLayer, nextFrameIndex, easeLoop } from '@/lib/cel-engine';

describe('cel-engine (one canvas, dirty layers only)', () => {
  it('redraws only dirty layers, static layers are blitted', () => {
    expect(shouldRedrawLayer('magic', ['hair_back', 'magic'])).toBe(true);
    expect(shouldRedrawLayer('body', ['hair_back', 'magic'])).toBe(false);
    expect(shouldRedrawLayer('body', [])).toBe(false);
  });

  it('loops frame index (classic 60-drawings-per-scene, programmatic)', () => {
    expect(nextFrameIndex(0, 60)).toBe(1);
    expect(nextFrameIndex(59, 60)).toBe(0);
  });

  it('rejects non-positive frame totals (no silent modulo-zero)', () => {
    expect(() => nextFrameIndex(0, 0)).toThrow();
  });

  it('easeLoop oscillates 0..1..0 over loop (hair wave)', () => {
    expect(easeLoop(0)).toBeCloseTo(0, 5);
    expect(easeLoop(0.5)).toBeCloseTo(1, 5);
    expect(easeLoop(1)).toBeCloseTo(0, 5);
  });
});
