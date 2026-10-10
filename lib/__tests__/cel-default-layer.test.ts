import { describe, it, expect, vi } from 'vitest';
import { startCelLoop } from '@/lib/cel-engine';

/** Default dirty layer = glowing magic sparkles (pngtree-style glow from palms). */
describe('startCelLoop default magic layer', () => {
  it('draws sparkles with lighter composite when no renderDirty given', async () => {
    vi.useFakeTimers();
    try {
      const ops: string[] = [];
      const gradient = { addColorStop: vi.fn() };
      const ctx = {
        getImageData: vi.fn(() => ({ data: [] })),
        putImageData: vi.fn(),
        save: vi.fn(() => ops.push('save')),
        restore: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        createRadialGradient: vi.fn(() => gradient),
        set globalCompositeOperation(v: string) {
          ops.push(`comp:${v}`);
        },
        set fillStyle(_v: string) {},
      };
      const canvas = { width: 64, height: 64, getContext: () => ctx } as unknown as HTMLCanvasElement;
      const ctl = new AbortController();
      let now = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => now);
      const rafQueue: FrameRequestCallback[] = [];
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafQueue.push(cb);
        return rafQueue.length;
      });

      const done = startCelLoop(canvas, { fps: 12, signal: ctl.signal });
      const cb = rafQueue.shift();
      now += 100;
      cb?.(now);
      expect(ctx.createRadialGradient).toHaveBeenCalled();
      expect(ops).toContain('comp:lighter');
      ctl.abort();
      rafQueue.shift()?.(now + 100);
      await done;
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });
});
