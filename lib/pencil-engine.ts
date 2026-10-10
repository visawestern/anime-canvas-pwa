/** Pencil emulation: procedural stroke playback on one canvas. */

export const FRAME_12FPS_MS = 1000 / 12;

export type Point = [number, number];

/** Return visible prefix of polyline at progress 0..1 (clamped). */
export function interpolateStroke(points: Point[], progress: number): Point[] {
  if (points.length === 0) return [];
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0) return [points[0]];
  if (p >= 1) return [...points];
  const scaled = p * (points.length - 1);
  const full = Math.floor(scaled);
  const frac = scaled - full;
  const out = points.slice(0, full + 1);
  if (frac > 0 && full + 1 < points.length) {
    const [x0, y0] = points[full];
    const [x1, y1] = points[full + 1];
    out.push([x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac]);
  }
  return out;
}

/** Pencil wobble: offset each point by (rand()-0.5)*2*amount. Bounded, recognizable. */
export function applyJitter(points: Point[], amount: number, rand: () => number = Math.random): Point[] {
  return points.map(([x, y]) => [x + (rand() - 0.5) * 2 * amount, y + (rand() - 0.5) * 2 * amount]);
}
