/** Cel animation: one canvas, static layers blitted, only dirty layers redrawn. */

/** True when layer must be redrawn this frame; static layers are blitted from offscreen cache. */
export function shouldRedrawLayer(layer: string, dirtyLayers: string[]): boolean {
  return dirtyLayers.includes(layer);
}

/** Next frame index in a loop of total frames (classic multi-drawing scene, programmatic). */
export function nextFrameIndex(current: number, total: number): number {
  if (total <= 0) throw new Error('total frames must be positive');
  return (current + 1) % total;
}

/** Oscillation 0→1→0 across loop progress 0..1 (e.g. hair wave, magic flow). */
export function easeLoop(t: number): number {
  return Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
}

export interface CelLoopOpts {
  fps?: number;
  /** Draw ONLY the moving parts for phase 0..1 (dirty layers). Static pixels come from snapshot. */
  renderDirty?: (ctx: CanvasRenderingContext2D, phase: number) => void;
  signal?: AbortSignal;
}

/**
 * Classic cel loop on one canvas: snapshot the finished drawing once,
 * then each frame restore the snapshot and draw only dirty layers.
 * Returns a stop() function. Resolves when aborted.
 */
export async function startCelLoop(
  canvas: HTMLCanvasElement,
  opts: CelLoopOpts = {},
): Promise<{ stop: () => void }> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  const g: CanvasRenderingContext2D = ctx;
  const fps = opts.fps ?? 12;
  const snapshot = g.getImageData(0, 0, canvas.width, canvas.height);
  const renderDirty = opts.renderDirty ?? ((c, phase) => drawMagicSparkles(c, canvas.width, canvas.height, phase));
  let stopped = false;
  let last = performance.now();
  let t0 = last;

  const stop = () => {
    stopped = true;
  };
  opts.signal?.addEventListener('abort', stop, { once: true });

  await new Promise<void>((resolve) => {
    function tick(now: number) {
      if (stopped || opts.signal?.aborted) return resolve();
      if (now - last >= 1000 / fps) {
        last = now;
        const phase = ((now - t0) / 2000) % 1; // 2s loop
        g.putImageData(snapshot, 0, 0);
        renderDirty(g, easeLoop(phase));
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
  return { stop };
}

/** Default dirty-layer demo: glowing magic sparkles drifting from palms area. */
function drawMagicSparkles(ctx: CanvasRenderingContext2D, w: number, h: number, phase: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const x = w * 0.62 + Math.sin(phase * Math.PI * 2 + i * 1.7) * 40 + i * 6;
    const y = h * 0.45 - phase * 60 - i * 7;
    const r = 2 + (i % 4) + phase * 3;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, 'rgba(190,150,255,0.9)');
    g.addColorStop(1, 'rgba(190,150,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
