/**
 * Surbhi write-on film: DrawingScript -> retained SVG DOM where every <g> draws
 * itself in sequence (pathLength=1 + --dl/--d dash animation, fills as contours).
 * Parts stay addressable: shiftLayerMarkup moves a <g> with zero redraw.
 */
import type { DrawingScript } from './drawing-script-schema';
import { strokeStyleFor } from './pencil-renderer';

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
  const steps = [...(script.steps ?? [])].sort((a, b) => a.id - b.id);

  // stroke phase length first: fills fade in only after every outline is drawn
  let strokeCount = 0;
  for (const step of steps) {
    for (const s of step.strokes ?? []) {
      if (s && typeof s.path === 'string' && s.path) strokeCount++;
    }
  }
  const strokeEnd = strokeCount > 0 ? (strokeCount - 1) * gap + dur : 0;

  const emit = (layer: string, label: string, d: string, id: string, style: string, width: number) => {
    if (!byLayer.has(layer)) {
      byLayer.set(layer, []);
      layers.push(layer);
    }
    const delay = t;
    t += gap;
    if (!layerStart.has(layer)) {
      layerStart.set(layer, delay);
      schedule.push({ layer, label, t: delay, kind: 'layer' });
    }
    byLayer
      .get(layer)!
      .push(
        `<path id="${id}" d="${d}" pathLength="1" fill="none" stroke="${style}" stroke-width="${width}" style="--dl:${delay.toFixed(2)}s;--d:${dur}s"/>`,
      );
  };

  const emitFill = (layer: string, d: string, id: string, color: string, fl: number) => {
    if (!byLayer.has(layer)) {
      byLayer.set(layer, []);
      layers.push(layer);
    }
    const delay = t;
    t += gap;
    byLayer
      .get(layer)!
      .push(
        `<path id="${id}" class="fillin" d="${d}" pathLength="1" fill="${color}" fill-opacity="0" stroke="#9a9aa5" stroke-width="1" style="--dl:${delay.toFixed(2)}s;--d:${dur}s;--fl:${fl.toFixed(2)}s;--fd:${FILL_DUR}s"/>`,
      );
  };

  for (const step of steps) {
    const layer = escId(typeof step.layer === 'string' ? step.layer : 'layer');
    const label = typeof step.label === 'string' ? step.label : step.kind;
    let si = 0;
    for (const s of step.strokes ?? []) {
      if (!s || typeof s.path !== 'string' || !s.path) continue;
      const w = typeof s.w === 'number' ? s.w : step.kind === 'ink' ? 2.4 : 1.2;
      const o = typeof s.o === 'number' ? s.o : 1;
      emit(layer, label, s.path, `s${step.id}-${si++}`, strokeStyleFor(step.kind === 'ink' ? 'ink' : 'pencil', { w, o }), w);
    }
    let fi = 0;
    for (const f of step.fills ?? []) {
      if (!f || typeof f.path !== 'string' || !f.path) continue;
      // Phase 2 (fillin like the reference): outline draws in its own slot,
      // Gemma's color fades in after the whole stroke phase.
      const fl = strokeEnd + fillIdx * FILL_GAP;
      fillIdx++;
      emitFill(layer, f.path, `s${step.id}-f${fi++}`, typeof f.color === 'string' ? f.color : '#999999', fl);
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
    total: Math.max(t + dur, fillEnd),
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
