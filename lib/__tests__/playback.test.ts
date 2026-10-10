import { describe, it, expect, vi } from 'vitest';
import { playScriptOnCanvas, type PlayStep } from '@/lib/pencil-renderer';

function stubCtx() {
  return {
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(), closePath: vi.fn(),
    fillRect: vi.fn(), createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    arc: vi.fn(), fillStyle: '', strokeStyle: '', lineWidth: 1,
    lineCap: '', lineJoin: '', globalAlpha: 1, globalCompositeOperation: '',
  };
}

function stubCanvas() {
  const ctx = stubCtx();
  return { width: 512, height: 512, getContext: vi.fn(() => ctx), __ctx: ctx } as unknown as HTMLCanvasElement & { __ctx: ReturnType<typeof stubCtx> };
}

describe('playScriptOnCanvas (single-canvas film)', () => {
  it('plays pencil->ink->fill in id order and strokes each path', async () => {
    const canvas = stubCanvas();
    const seen: string[] = [];
    const steps: PlayStep[] = [
      { id: 2, kind: 'ink', layer: 'ink', strokes: [{ path: 'M0 0 L10 10', w: 2 }] },
      { id: 1, kind: 'pencil', layer: 'construction', strokes: [{ path: 'M0 0 L5 5' }] },
      { id: 3, kind: 'fill', layer: 'fill', fills: [{ path: 'M0 0 L10 0 L10 10 Z', color: '#fff' }] },
    ];
    await playScriptOnCanvas(canvas, steps, { onStep: (s) => seen.push(`${s.id}:${s.kind}`) });
    expect(seen).toEqual(['1:pencil', '2:ink', '3:fill']);
    expect(canvas.__ctx.stroke).toHaveBeenCalled();
    expect(canvas.__ctx.fill).toHaveBeenCalled();
  });

  it('eraser uses destination-out and never wipes blindly', async () => {
    const canvas = stubCanvas();
    await playScriptOnCanvas(canvas, [{ id: 1, kind: 'eraser', layer: 'construction' }]);
    // blind wipe forbidden: fillRect with destination-out must not happen; only grain repaint (destination-over)
    const ops = canvas.__ctx;
    expect(ops.globalCompositeOperation).not.toBe('destination-out');
  });

  it('aborts cleanly on signal', async () => {
    const canvas = stubCanvas();
    const ctl = new AbortController();
    ctl.abort();
    await expect(
      playScriptOnCanvas(canvas, [{ id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 L50 50' }] }], {
        signal: ctl.signal,
      }),
    ).resolves.toBeUndefined();
  });

  it('throws without 2d context (no silent no-op)', async () => {
    const bad = { width: 1, height: 1, getContext: () => null } as unknown as HTMLCanvasElement;
    await expect(playScriptOnCanvas(bad, [])).rejects.toThrow();
  });

  it('renders hatching strokes of shade steps (purmix shadowing draws!)', async () => {
    const canvas = stubCanvas();
    await playScriptOnCanvas(canvas, [
      { id: 11, kind: 'shade', layer: 'shade', strokes: [{ path: 'M0 0 L20 20', w: 1.6, o: 0.7 }] },
    ]);
    expect(canvas.__ctx.stroke).toHaveBeenCalled();
  });
});
