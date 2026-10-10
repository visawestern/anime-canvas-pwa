import { describe, it, expect, vi } from 'vitest';
import { startCelLoop } from '@/lib/cel-engine';

describe('startCelLoop (dirty layers only)', () => {
  it('restores snapshot then renders dirty each frame; stops on abort', async () => {
    vi.useFakeTimers();
    try {
      const putImageData = vi.fn();
      const ctx = { getImageData: vi.fn(() => ({ data: [] })), putImageData };
      const canvas = { width: 64, height: 64, getContext: () => ctx } as unknown as HTMLCanvasElement;
      const renderDirty = vi.fn();
      const ctl = new AbortController();

      let now = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => now);
      const rafQueue: FrameRequestCallback[] = [];
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafQueue.push(cb);
        return rafQueue.length;
      });

      const done = startCelLoop(canvas, { fps: 12, renderDirty, signal: ctl.signal });
      // pump frames: each tick schedules next; advance time past frame budget
      for (let i = 0; i < 5; i++) {
        const cb = rafQueue.shift();
        if (!cb) break;
        now += 100;
        cb(now);
      }
      expect(ctx.getImageData).toHaveBeenCalledTimes(1); // snapshot once
      expect(putImageData.mock.calls.length).toBeGreaterThan(0); // static restored per frame
      expect(renderDirty.mock.calls.length).toBe(putImageData.mock.calls.length);
      for (const [, phase] of renderDirty.mock.calls) {
        expect(phase).toBeGreaterThanOrEqual(0);
        expect(phase).toBeLessThanOrEqual(1);
      }
      ctl.abort();
      const cb = rafQueue.shift();
      cb?.(now + 100);
      await done;
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it('throws without 2d context', async () => {
    const bad = { width: 1, height: 1, getContext: () => null } as unknown as HTMLCanvasElement;
    await expect(startCelLoop(bad)).rejects.toThrow();
  });
});
