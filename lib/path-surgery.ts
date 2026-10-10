/**
 * Path surgery distilled from the Surbhi pencil-animation lesson:
 * hand-read paths can be fixed, trimmed and simplified instead of redrawn.
 * simplifyPath = Ramer–Douglas–Peucker (drop wobble anchors, keep corners).
 * trimPoints = delete a stale index range (old animation tails, erased spans).
 */
import type { Point } from './pencil-engine';

function perpDist(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function simplifyPath(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return [...points];
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [s, e] = stack.pop() as [number, number];
    let dmax = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], points[s], points[e]);
      if (d > dmax) {
        dmax = d;
        idx = i;
      }
    }
    if (dmax > tolerance && idx !== -1) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export function trimPoints(points: Point[], start: number, end: number): Point[] {
  if (start > end) return [...points];
  const s = Math.max(0, Math.floor(start));
  const e = Math.min(points.length - 1, Math.ceil(end));
  return points.filter((_, i) => i < s || i > e);
}
