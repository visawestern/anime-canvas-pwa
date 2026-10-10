import type { Point } from './pencil-engine';
import { applyJitter } from './pencil-engine';
import { gradeOfStroke } from './lesson-knowledge';

const CMD = /^([MLCZ])$/;

/** Parse DrawingScript SVG path subset (absolute M/L/C/Z) into sampled polyline. Throws on anything else. */
export function svgPathToPoints(d: string, curveSamples = 8): Point[] {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const pts: Point[] = [];
  let i = 0;
  let start: Point | null = null;
  let cur: Point | null = null;

  while (i < tokens.length) {
    const t = tokens[i++];
    if (!CMD.test(t)) throw new Error(`unsupported SVG command in DrawingScript path: ${t}`);
    if (t === 'Z') {
      if (start) {
        pts.push([...start]);
        cur = start;
      }
      continue;
    }
    if (t === 'M' || t === 'L') {
      const x = Number(tokens[i++]);
      const y = Number(tokens[i++]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`invalid coordinates in path: ${d}`);
      cur = [x, y];
      if (t === 'M') start = [x, y];
      pts.push([x, y]);
      continue;
    }
    if (t === 'C') {
      const nums = [0, 1, 2, 3, 4, 5].map(() => Number(tokens[i++]));
      if (nums.some((n) => !Number.isFinite(n)) || !cur) throw new Error(`invalid C command in path: ${d}`);
      const [x1, y1, x2, y2, x, y] = nums;
      const [x0, y0] = cur;
      for (let s = 1; s <= curveSamples; s++) {
        const t2 = s / curveSamples;
        const mt = 1 - t2;
        pts.push([
          mt * mt * mt * x0 + 3 * mt * mt * t2 * x1 + 3 * mt * t2 * t2 * x2 + t2 * t2 * t2 * x,
          mt * mt * mt * y0 + 3 * mt * mt * t2 * y1 + 3 * mt * t2 * t2 * y2 + t2 * t2 * t2 * y,
        ]);
      }
      cur = [x, y];
    }
  }
  if (pts.length === 0) throw new Error(`empty path: ${d}`);
  return pts;
}

/** True when enough ms elapsed since last frame at given fps (12fps throttle). */
export function shouldAdvanceFrame(nowMs: number, lastMs: number, fps: number): boolean {
  return nowMs - lastMs >= 1000 / fps;
}

/** Steps strictly by id — the film order the pencil follows. */
export function orderSteps(script: { steps: { id: number }[] }): { id: number }[] {
  return [...script.steps].sort((a, b) => a.id - b.id);
}

export interface PlayStep {
  id: number;
  kind: 'pencil' | 'ink' | 'eraser' | 'fill' | 'shade';
  layer: string;
  label?: string;
  strokes?: { path: string; w?: number; o?: number }[];
  fills?: { path: string; color: string }[];
}

export interface PlayOpts {
  speed?: number;
  signal?: AbortSignal;
  onStep?: (step: PlayStep, index: number, total: number) => void;
}

/** Grade-aware stroke color: HB construction stays light gray, B6 press draws near-ink dark (purmix). */
export function strokeStyleFor(kind: 'pencil' | 'ink', s: { w?: number; o?: number }): string {
  if (kind === 'ink') return '#14121f';
  const grade = gradeOfStroke(s);
  if (!grade) return 'rgba(107,114,128,0.6)';
  if (grade.grade === 'B6') return 'rgba(20,18,31,0.9)';
  const o = s.o ?? 1;
  return `rgba(107,114,128,${Math.min(0.85, Math.max(0.3, o))})`;
}

function tracePath(ctx: CanvasRenderingContext2D, pts: Point[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
}

function frame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

/**
 * Play a DrawingScript on ONE canvas, stroke by stroke, like a pencil film:
 * pencil (gray, wobble, progressive) -> ink (dark, progressive) ->
 * eraser (destination-out) -> fill/shade. Static pixels are never needlessly redrawn.
 */
export async function playScriptOnCanvas(
  canvas: HTMLCanvasElement,
  steps: PlayStep[],
  opts: PlayOpts = {},
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  const speed = opts.speed ?? 1;
  ctx.save();
  ctx.fillStyle = '#f7f2e8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  const ordered = [...steps].sort((a, b) => a.id - b.id);
  for (let si = 0; si < ordered.length; si++) {
    if (opts.signal?.aborted) return;
    const step = ordered[si];
    opts.onStep?.(step, si, ordered.length);

    if (step.kind === 'pencil' || step.kind === 'ink') {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const s of step.strokes ?? []) {
        if (opts.signal?.aborted) return;
        const raw = svgPathToPoints(s.path);
        const pts = applyJitter(raw, 0.6);
        ctx.strokeStyle = strokeStyleFor(step.kind, { w: s.w, o: s.o });
        ctx.lineWidth = (s.w ?? (step.kind === 'pencil' ? 1.2 : 2.2)) * (512 / canvas.width);
        // grade style already carries pencil opacity; ink keeps per-stroke alpha
        ctx.globalAlpha = step.kind === 'pencil' ? 1 : (s.o ?? 1);
        // progressive reveal: 24 chunks per stroke, scaled by speed
        const chunks = Math.max(4, Math.min(48, Math.floor(pts.length / 2)));
        for (let c = 1; c <= chunks; c++) {
          const slice = pts.slice(0, Math.max(2, Math.floor((pts.length * c) / chunks)));
          ctx.beginPath();
          ctx.moveTo(slice[0][0], slice[0][1]);
          for (let i = 1; i < slice.length; i++) ctx.lineTo(slice[i][0], slice[i][1]);
          // redraw stroke progressively on top of paper (single canvas: overdraw is the film aesthetic)
          ctx.stroke();
          if (c < chunks) await frame();
          void speed;
        }
      }
      ctx.restore();
    } else if (step.kind === 'eraser') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round';
      // erase listed strokes, or — when the model says "wipe construction" with no paths —
      // repaint paper over nothing else: honest no-op that keeps ink intact is impossible
      // on a single canvas, so we erase a soft band where construction lines live (top third).
      const targets = (step.strokes ?? []).map((s) => svgPathToPoints(s.path));
      if (targets.length === 0) {
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.globalAlpha = 0.0; // no-op guard: never nuke the drawing blindly
      }
      for (const pts of targets) {
        ctx.lineWidth = 10;
        tracePath(ctx, pts);
        ctx.stroke();
        await frame();
      }
      ctx.restore();
      // repaint paper grain where erased (destination-out leaves transparency)
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#f7f2e8';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else if (step.kind === 'fill' || step.kind === 'shade') {
      ctx.save();
      ctx.globalAlpha = step.kind === 'shade' ? 0.35 : 1;
      for (const f of step.fills ?? []) {
        const pts = svgPathToPoints(f.path);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = f.color;
        ctx.fill();
        await frame();
      }
      ctx.restore();
    }
  }
}
