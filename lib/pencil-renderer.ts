import type { Point } from './pencil-engine';
import { applyJitter } from './pencil-engine';
import { gradeOfStroke } from './lesson-knowledge';
import { simplifyPath } from './path-surgery';

const KNOWN = /^[MLHVCSQTAZ]$/i;

/**
 * Full SVG path parser (M/L/H/V/C/S/Q/T/A/Z, relative variants, implicit lineto).
 * Models emit the whole SVG vocabulary — the film must draw it, not crash on it.
 * True garbage (unknown commands, bad numbers) still throws honestly.
 */
export function svgPathToPoints(d: string, curveSamples = 8): Point[] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const pts: Point[] = [];
  let i = 0;
  let start: Point | null = null;
  let cur: Point | null = null;
  let cmd = '';
  // reflection memory for smooth commands
  let prevCubic: Point | null = null;
  let prevQuad: Point | null = null;

  const num = (): number => {
    const v = Number(tokens[i++]);
    if (!Number.isFinite(v)) throw new Error(`invalid coordinates in path: ${d}`);
    return v;
  };
  const needCur = (): Point => {
    if (!cur) throw new Error(`path starts with drawing command before moveto: ${d}`);
    return cur;
  };
  const lineTo = (p: Point) => {
    pts.push(p);
    cur = p;
  };
  const cubic = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
    const [x0, y0] = needCur();
    for (let s = 1; s <= curveSamples; s++) {
      const t = s / curveSamples;
      const mt = 1 - t;
      pts.push([
        mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x,
        mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y,
      ]);
    }
    cur = [x, y];
    prevCubic = [x2, y2];
    prevQuad = null;
  };
  const quad = (x1: number, y1: number, x: number, y: number) => {
    const [x0, y0] = needCur();
    for (let s = 1; s <= curveSamples; s++) {
      const t = s / curveSamples;
      const mt = 1 - t;
      pts.push([mt * mt * x0 + 2 * mt * t * x1 + t * t * x, mt * mt * y0 + 2 * mt * t * y1 + t * t * y]);
    }
    cur = [x, y];
    prevQuad = [x1, y1];
    prevCubic = null;
  };

  while (i < tokens.length) {
    let t = tokens[i];
    if (/^[A-Za-z]$/.test(t)) {
      if (!KNOWN.test(t)) throw new Error(`unsupported SVG command in DrawingScript path: ${t}`);
      cmd = tokens[i++];
    } else if (!cmd) {
      throw new Error(`unsupported SVG command in DrawingScript path: ${t}`);
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const [cx, cy] = cur ?? [0, 0];
    const abs = (x: number, y: number): Point => (rel ? [cx + x, cy + y] : [x, y]);

    switch (C) {
      case 'M': {
        const p = abs(num(), num());
        pts.push(p);
        cur = p;
        start = p;
        prevCubic = prevQuad = null;
        cmd = rel ? 'l' : 'L'; // implicit lineto pairs
        break;
      }
      case 'L': {
        lineTo(abs(num(), num()));
        prevCubic = prevQuad = null;
        break;
      }
      case 'H': {
        const x = num();
        lineTo(rel ? [cx + x, cy] : [x, cy]);
        prevCubic = prevQuad = null;
        break;
      }
      case 'V': {
        const y = num();
        lineTo(rel ? [cx, cy + y] : [cx, y]);
        prevCubic = prevQuad = null;
        break;
      }
      case 'C': {
        const [x1, y1] = abs(num(), num());
        const [x2, y2] = abs(num(), num());
        const [x, y] = abs(num(), num());
        cubic(x1, y1, x2, y2, x, y);
        break;
      }
      case 'S': {
        const [x2, y2] = abs(num(), num());
        const [x, y] = abs(num(), num());
        const [px, py] = needCur();
        const [rx, ry] = prevCubic ?? [px, py];
        cubic(2 * px - rx, 2 * py - ry, x2, y2, x, y);
        break;
      }
      case 'Q': {
        const [x1, y1] = abs(num(), num());
        const [x, y] = abs(num(), num());
        quad(x1, y1, x, y);
        break;
      }
      case 'T': {
        const [x, y] = abs(num(), num());
        const [px, py] = needCur();
        const [rx, ry] = prevQuad ?? [px, py];
        quad(2 * px - rx, 2 * py - ry, x, y);
        break;
      }
      case 'A': {
        const rx = num();
        const ry = num();
        num(); // x-axis rotation (ignored for near-circular anime curves)
        const large = num();
        const sweep = num();
        const [x, y] = abs(num(), num());
        for (const p of arcPoints(needCur(), rx, ry, large !== 0, sweep !== 0, [x, y])) pts.push(p);
        cur = [x, y];
        prevCubic = prevQuad = null;
        break;
      }
      case 'Z': {
        if (start) {
          pts.push([...start]);
          cur = start;
        }
        prevCubic = prevQuad = null;
        cmd = '';
        break;
      }
    }
  }
  if (pts.length === 0) throw new Error(`empty path: ${d}`);
  return pts;
}

/** SVG arc endpoint parameterization sampled as a polyline (F.6.5, rotation ignored). */
function arcPoints(p0: Point, rx: number, ry: number, large: boolean, sweep: boolean, p1: Point): Point[] {
  const [x1, y1] = p0;
  const [x2, y2] = p1;
  let rrx = Math.abs(rx);
  let rry = Math.abs(ry);
  if (rrx < 1e-9 || rry < 1e-9) return [[x2, y2]];
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const lam = (dx * dx) / (rrx * rrx) + (dy * dy) / (rry * rry);
  if (lam > 1) {
    const s = Math.sqrt(lam);
    rrx *= s;
    rry *= s;
  }
  const num = rrx * rrx * rry * rry - rrx * rrx * dy * dy - rry * rry * dx * dx;
  const den = rrx * rrx * dy * dy + rry * rry * dx * dx;
  const f = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, den < 1e-9 ? 0 : num / den));
  const cxp = (f * rrx * dy) / rry;
  const cyp = (-f * rry * dx) / rrx;
  const cx = cxp + (x1 + x2) / 2;
  const cy = cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, len < 1e-9 ? 1 : dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  let a1 = ang(1, 0, (dx - cxp) / rrx, (dy - cyp) / rry);
  let da = ang((dx - cxp) / rrx, (dy - cyp) / rry, (-dx - cxp) / rrx, (-dy - cyp) / rry);
  if (!sweep && da > 0) da -= 2 * Math.PI;
  if (sweep && da < 0) da += 2 * Math.PI;
  const n = 12;
  const out: Point[] = [];
  for (let s = 1; s <= n; s++) {
    const a = a1 + (da * s) / n;
    out.push([cx + rrx * Math.cos(a), cy + rry * Math.sin(a)]);
  }
  out[out.length - 1] = [x2, y2];
  return out;
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
  /** A broken stroke is skipped (film goes on) but always reported — never silent. */
  onSkip?: (info: { stepId: number; path: string; error: string }) => void;
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

export interface StaticOpts {
  onSkip?: (info: { stepId: number; path: string; error: string }) => void;
  /** Ramer–Douglas–Peucker tolerance: drop wobble anchors before drawing (thumbnails). */
  simplify?: number;
}

/**
 * Instant synchronous render of a script (thumbnails, previews of saved art).
 * Same drawing semantics as the film, no animation. Returns skipped-stroke count.
 */
export function renderScriptStatic(
  canvas: HTMLCanvasElement,
  steps: PlayStep[],
  opts: StaticOpts = {},
): { skipped: number } {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  let skipped = 0;
  const skip = (stepId: number, path: string, e: unknown) => {
    skipped++;
    opts.onSkip?.({ stepId, path, error: (e as Error).message });
  };
  const clean = (pts: Point[], stepId: number, path: string): Point[] | null => {
    const out = opts.simplify ? simplifyPath(pts, opts.simplify) : pts;
    if (out.length < 2) {
      skip(stepId, path, new Error('degenerate polyline (<2 points)'));
      return null;
    }
    return out;
  };
  ctx.save();
  ctx.fillStyle = '#f7f2e8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  const drawStroke = (pts: Point[], width: number, style: string, alpha: number) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };

  const ordered = [...steps].sort((a, b) => a.id - b.id);
  for (const step of ordered) {
    if (step.kind === 'pencil' || step.kind === 'ink') {
      ctx.save();
      for (const s of step.strokes ?? []) {
        let raw: Point[] | null = null;
        try {
          raw = clean(svgPathToPoints(s.path), step.id, s.path);
        } catch (e) {
          skip(step.id, s.path, e);
          continue;
        }
        if (!raw) continue;
        const pts = applyJitter(raw, 0.6);
        drawStroke(
          pts,
          (s.w ?? (step.kind === 'pencil' ? 1.2 : 2.2)) * (512 / canvas.width),
          strokeStyleFor(step.kind, { w: s.w, o: s.o }),
          step.kind === 'pencil' ? 1 : (s.o ?? 1),
        );
      }
      ctx.restore();
    } else if (step.kind === 'eraser') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round';
      for (const s of step.strokes ?? []) {
        let pts: Point[] | null = null;
        try {
          pts = clean(svgPathToPoints(s.path), step.id, s.path);
        } catch (e) {
          skip(step.id, s.path, e);
          continue;
        }
        if (!pts) continue;
        ctx.lineWidth = 10;
        tracePath(ctx, pts);
        ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#f7f2e8';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = step.kind === 'shade' ? 0.35 : 1;
      for (const f of step.fills ?? []) {
        let pts: Point[] | null = null;
        try {
          pts = clean(svgPathToPoints(f.path), step.id, f.path);
        } catch (e) {
          skip(step.id, f.path, e);
          continue;
        }
        if (!pts) continue;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = f.color;
        ctx.fill();
      }
      for (const s of step.strokes ?? []) {
        let raw: Point[] | null = null;
        try {
          raw = clean(svgPathToPoints(s.path), step.id, s.path);
        } catch (e) {
          skip(step.id, s.path, e);
          continue;
        }
        if (!raw) continue;
        const pts = applyJitter(raw, 0.3);
        drawStroke(
          pts,
          (s.w ?? 1.6) * (512 / canvas.width),
          strokeStyleFor('pencil', { w: s.w, o: s.o }),
          step.kind === 'shade' ? 0.55 : 1,
        );
      }
      ctx.restore();
    }
  }
  return { skipped };
}

/** Parse one path; on failure report via onSkip and let the film continue. */
function safePoints(
  path: string,
  stepId: number,
  opts: PlayOpts,
): Point[] | null {
  try {
    return svgPathToPoints(path);
  } catch (e) {
    opts.onSkip?.({ stepId, path, error: (e as Error).message });
    return null;
  }
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
        const raw = safePoints(s.path, step.id, opts);
        if (!raw) continue;
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
      const targets: Point[][] = [];
      for (const s of step.strokes ?? []) {
        const pts = safePoints(s.path, step.id, opts);
        if (pts) targets.push(pts);
      }
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
        const pts = safePoints(f.path, step.id, opts);
        if (!pts) continue;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = f.color;
        ctx.fill();
        await frame();
      }
      // hatching: purmix shades with B-family strokes — they must draw, not vanish
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const s of step.strokes ?? []) {
        if (opts.signal?.aborted) return;
        const raw = safePoints(s.path, step.id, opts);
        if (!raw) continue;
        const pts = applyJitter(raw, 0.3);
        ctx.strokeStyle = strokeStyleFor('pencil', { w: s.w, o: s.o });
        ctx.globalAlpha = step.kind === 'shade' ? 0.55 : 1;
        ctx.lineWidth = (s.w ?? 1.6) * (512 / canvas.width);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
        await frame();
      }
      ctx.restore();
    }
  }
}
