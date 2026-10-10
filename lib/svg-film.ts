/**
 * Surbhi write-on film: DrawingScript -> retained SVG DOM where every <g> draws
 * itself in sequence (pathLength=1 + --dl/--d dash animation, fills as contours).
 * Parts stay addressable: shiftLayerMarkup moves a <g> with zero redraw.
 */
import type { DrawingScript } from './drawing-script-schema';
import { strokeStyleFor, svgPathToPoints } from './pencil-renderer';
import type { Point } from './pencil-engine';

export interface FilmScheduleEntry {
  layer: string;
  label: string;
  t: number;
  kind: 'layer' | 'fills';
}

export interface FilmScript {
  svg: string;
  schedule: FilmScheduleEntry[];
  /** total film seconds (last delay + stroke duration) */
  total: number;
}

const STEP_GAP = 0.35;
const STROKE_DUR = 0.9;
const FILL_GAP = 0.3;
const FILL_DUR = 0.8;
/** Uniform drawing speed: every part draws at the same units/sec, no fast/slow limbs. */
const DRAW_SPEED = 260;

function polyLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return len;
}

/** Duration for one path at uniform speed (zero-length dots pop instantly by design). */
function pathDur(d: string, fallback: number): number {
  try {
    return polyLength(svgPathToPoints(d)) / DRAW_SPEED;
  } catch {
    return fallback;
  }
}

function escId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || 'layer';
}

export function scriptToSvg(
  script: DrawingScript,
  opts: { gap?: number; dur?: number } = {},
): FilmScript {
  const gap = opts.gap ?? STEP_GAP;
  const dur = opts.dur ?? STROKE_DUR;
  const layers: string[] = [];
  const byLayer = new Map<string, string[]>();
  const schedule: FilmScheduleEntry[] = [];
  const layerStart = new Map<string, number>();
  let t = 0;
  let fillIdx = 0;
  let endMax = 0;
  const steps = [...(script.steps ?? [])].sort((a, b) => a.id - b.id);

  // Phase 1 covers every outline (strokes AND fill contours) at uniform speed;
  // Phase 2 fades Gemma colors in after the last outline completes.
  interface Job {
    stepId: number;
    layer: string;
    label: string;
    path: string;
    fill: string | null;
    ink: boolean;
    w: number;
    o: number;
    id: string;
    dd: number;
  }
  const jobs: Job[] = [];
  for (const step of steps) {
    const layer = escId(typeof step.layer === 'string' ? step.layer : 'layer');
    const label = typeof step.label === 'string' ? step.label : step.kind;
    const ink = step.kind === 'ink';
    let si = 0;
    for (const s of step.strokes ?? []) {
      if (!s || typeof s.path !== 'string' || !s.path) continue;
      const w = typeof s.w === 'number' ? s.w : step.kind === 'ink' ? 2.4 : 1.2;
      const o = typeof s.o === 'number' ? s.o : 1;
      jobs.push({ stepId: step.id, layer, label, path: s.path, fill: null, ink, w, o, id: `s${step.id}-${si++}`, dd: pathDur(s.path, dur) });
    }
    let fi = 0;
    for (const f of step.fills ?? []) {
      if (!f || typeof f.path !== 'string' || !f.path) continue;
      jobs.push({ stepId: step.id, layer, label, path: f.path, fill: typeof f.color === 'string' ? f.color : '#999999', ink: false, w: 1, o: 1, id: `s${step.id}-f${fi++}`, dd: pathDur(f.path, dur) });
    }
  }
  const strokeEnd = jobs.reduce((m, j, i) => Math.max(m, i * gap + j.dd), 0);

  const emit = (layer: string, label: string, d: string, id: string, style: string, width: number, dd: number) => {
    if (!byLayer.has(layer)) {
      byLayer.set(layer, []);
      layers.push(layer);
    }
    const delay = t;
    t += gap;
    endMax = Math.max(endMax, delay + dd);
    if (!layerStart.has(layer)) {
      layerStart.set(layer, delay);
      schedule.push({ layer, label, t: delay, kind: 'layer' });
    }
    byLayer
      .get(layer)!
      .push(
        `<path id="${id}" d="${d}" pathLength="1" fill="none" stroke="${style}" stroke-width="${width}" style="--dl:${delay.toFixed(2)}s;--d:${dd.toFixed(2)}s"/>`,
      );
  };

  const emitFill = (layer: string, d: string, id: string, color: string, fl: number, dd: number) => {
    if (!byLayer.has(layer)) {
      byLayer.set(layer, []);
      layers.push(layer);
    }
    const delay = t;
    t += gap;
    endMax = Math.max(endMax, delay + dd, fl + FILL_DUR);
    byLayer
      .get(layer)!
      .push(
        `<path id="${id}" class="fillin" d="${d}" pathLength="1" fill="${color}" fill-opacity="0" stroke="#9a9aa5" stroke-width="1" style="--dl:${delay.toFixed(2)}s;--d:${dd.toFixed(2)}s;--fl:${fl.toFixed(2)}s;--fd:${FILL_DUR}s"/>`,
      );
  };

  for (const [ji, job] of jobs.entries()) {
    const delay = ji * gap;
    t = delay + gap;
    if (job.fill === null) {
      const style = strokeStyleFor(job.ink ? 'ink' : 'pencil', { w: job.w, o: job.o });
      emit(job.layer, job.label, job.path, job.id, style, job.w, job.dd);
    } else {
      // Phase 2 (fillin like the reference): outline draws in its own slot,
      // Gemma's color fades in after the whole outline phase.
      const fl = strokeEnd + fillIdx * FILL_GAP;
      fillIdx++;
      emitFill(job.layer, job.path, job.id, job.fill, fl, job.dd);
    }
  }

  const groups = layers.map((l) => `<g id="layer-${l}">${(byLayer.get(l) ?? []).join('')}</g>`).join('');
  const fillEnd = fillIdx > 0 ? strokeEnd + (fillIdx - 1) * FILL_GAP + FILL_DUR : 0;
  if (fillIdx > 0) {
    schedule.push({ layer: '__fills', label: 'заливка цветом', t: strokeEnd, kind: 'fills' });
  }
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" data-film="animecanvas">${groups}</svg>`,
    schedule,
    total: Math.max(endMax, fillEnd, t > 0 ? 0 : dur),
  };
}

/** Move one <g> by (dx,dy) inside the markup — no redraw, accumulates. */
export function shiftLayerMarkup(svg: string, layerId: string, dx: number, dy: number): string {
  const re = new RegExp(`<g id="${layerId}"([^>]*)>`);
  const m = svg.match(re);
  if (!m) throw new Error(`unknown layer in film: ${layerId}`);
  const attrs = m[1];
  const cur = /transform="translate\(([-\d.]+) ([-\d.]+)\)"/.exec(attrs);
  const nx = (cur ? Number(cur[1]) : 0) + dx;
  const ny = (cur ? Number(cur[2]) : 0) + dy;
  const next = cur
    ? attrs.replace(/transform="translate\([-\d.]+ [-\d.]+\)"/, `transform="translate(${nx} ${ny})"`)
    : `${attrs} transform="translate(${nx} ${ny})"`;
  return svg.replace(re, `<g id="${layerId}"${next}>`);
}

export interface FilmVerification {
  ok: boolean;
  paths: number;
  layers: string[];
  issues: string[];
}

const FRAME_MIN = -50;
const FRAME_MAX = 562;

/** Re-check of the finished drawing: parse our own film markup and verify every path. */
export function verifyFilm(svg: string): FilmVerification {
  const issues: string[] = [];
  const layers: string[] = [];
  let paths = 0;
  const groups = svg.match(/<g id="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g) ?? [];
  for (const g of groups) {
    const id = /<g id="([^"]+)"/.exec(g)?.[1] ?? '?';
    if (id !== '__fills') layers.push(id);
    const ds = [...g.matchAll(/<path[^>]*d="([^"]*)"/g)].map((m) => m[1]);
    for (const d of ds) {
      paths++;
      let pts: Point[] | null = null;
      try {
        pts = svgPathToPoints(d);
      } catch (e) {
        issues.push(`unparseable path in ${id}: ${(e as Error).message.slice(0, 80)}`);
        continue;
      }
      const distinct = new Set(pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`));
      if (distinct.size < 2) {
        issues.push(`degenerate path in ${id} (single point, nothing drawn)`);
        continue;
      }
      if (pts.every((p) => p[0] < FRAME_MIN || p[0] > FRAME_MAX || p[1] < FRAME_MIN || p[1] > FRAME_MAX)) {
        issues.push(`art outside the frame in ${id} (nothing visible on canvas)`);
      }
    }
  }
  if (paths === 0) issues.push('empty film: nothing was drawn');
  return { ok: issues.length === 0, paths, layers, issues };
}
