import { describe, it, expect, vi } from 'vitest';
import { renderScriptStatic } from '@/lib/pencil-renderer';
import type { PlayStep } from '@/lib/pencil-renderer';

function stubCtx() {
  return {
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(), closePath: vi.fn(),
    fillRect: vi.fn(),
    set fillStyle(_v: string) {},
    set strokeStyle(_v: string) {},
    lineWidth: 1, lineCap: '', lineJoin: '', globalAlpha: 1, globalCompositeOperation: '',
  };
}

function stubCanvas() {
  const ctx = stubCtx();
  return { width: 96, height: 96, getContext: vi.fn(() => ctx), __ctx: ctx } as unknown as HTMLCanvasElement & { __ctx: ReturnType<typeof stubCtx> };
}

const pencil: PlayStep = { id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 L10 10', w: 1.2, o: 0.5 }] };
const ink: PlayStep = { id: 2, kind: 'ink', layer: 'a', strokes: [{ path: 'M0 0 L10 10', w: 2.4, o: 1 }] };
const fill: PlayStep = { id: 3, kind: 'fill', layer: 'a', fills: [{ path: 'M0 0 L10 0 L10 10 Z', color: '#fff' }] };

describe('renderScriptStatic (instant thumbnails)', () => {
  it('draws all kinds synchronously without animation frames', () => {
    const canvas = stubCanvas();
    const { skipped } = renderScriptStatic(canvas, [pencil, ink, fill]);
    expect(skipped).toBe(0);
    expect(canvas.__ctx.stroke).toHaveBeenCalled();
    expect(canvas.__ctx.fill).toHaveBeenCalled();
    expect(canvas.__ctx.fillRect).toHaveBeenCalled(); // paper base
  });

  it('skips broken geometry, reports it, still draws the rest', () => {
    const canvas = stubCanvas();
    const bad: PlayStep = { id: 2, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 X1 1' }] };
    const seen: string[] = [];
    const { skipped } = renderScriptStatic(canvas, [pencil, bad, fill], {
      onSkip: (s) => seen.push(s.path),
    });
    expect(skipped).toBe(1);
    expect(seen).toEqual(['M0 0 X1 1']);
    expect(canvas.__ctx.stroke).toHaveBeenCalled();
  });

  it('throws without 2d context (caller decides, no silent blank thumb)', () => {
    const bad = { width: 1, height: 1, getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => renderScriptStatic(bad, [pencil])).toThrow();
  });

  it('simplifies wobble anchors when asked, still drawing the stroke', () => {
    const canvas = stubCanvas();
    const wobbly: PlayStep = {
      id: 1,
      kind: 'pencil',
      layer: 'a',
      strokes: [{ path: 'M0 0 L10 0 L20 0 L30 0', w: 1.2, o: 0.5 }],
    };
    const { skipped } = renderScriptStatic(canvas, [wobbly], { simplify: 5 });
    expect(skipped).toBe(0);
    expect(canvas.__ctx.stroke).toHaveBeenCalled();
  });
});
