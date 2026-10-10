/**
 * Normalizes raw model JSON into canonical DrawingScript shape before schema validation.
 * Handles the drift LLMs actually produce (style objects, d/points aliases, missing ids,
 * joint/start/end bones, boolean loop) and records every repair as a warning.
 * Anything unrepairable is left for the schema to reject honestly — never invented silently.
 */

export interface NormalizeResult {
  script: unknown;
  warnings: string[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asNumPair(v: unknown): [number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 2) return undefined;
  const [a, b] = v;
  return typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)
    ? [a, b]
    : undefined;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function pointsToPath(points: unknown): string | undefined {
  if (!Array.isArray(points) || points.length < 2) return undefined;
  const pts: [number, number][] = [];
  for (const p of points) {
    if (Array.isArray(p)) {
      const pair = asNumPair(p);
      if (!pair) return undefined;
      pts.push(pair);
    } else if (isObj(p) && typeof p.x === 'number' && typeof p.y === 'number') {
      pts.push([p.x, p.y]);
    } else {
      return undefined;
    }
  }
  const [[x0, y0], ...rest] = pts;
  return `M${fmt(x0)} ${fmt(y0)}` + rest.map(([x, y]) => ` L${fmt(x)} ${fmt(y)}`).join('');
}

const STEP_KINDS = ['pencil', 'ink', 'eraser', 'fill', 'shade'];

function normalizeStroke(st: unknown, where: string, warnings: string[]): Record<string, unknown> | null {
  if (!isObj(st)) return null;
  const out: Record<string, unknown> = {};
  const path = asString(st.path) ?? asString(st.d);
  if (asString(st.d) && !asString(st.path)) warnings.push(`${where}: d -> path`);
  const fromPoints = !path ? pointsToPath(st.points) : undefined;
  if (fromPoints) warnings.push(`${where}: points -> path`);
  const finalPath = path ?? fromPoints;
  if (!finalPath) {
    warnings.push(`${where}: dropped stroke without geometry`);
    return null;
  }
  out.path = finalPath;
  if (typeof st.w === 'number') out.w = st.w;
  if (typeof st.o === 'number') out.o = st.o;
  return out;
}

function normalizeStep(s: unknown, index: number, warnings: string[]): unknown {
  if (!isObj(s)) return s;
  const where = `steps[${index}]`;
  const out: Record<string, unknown> = { ...s };
  const id = typeof s.id === 'number' ? s.id : typeof s.n === 'number' ? s.n : typeof s.order === 'number' ? s.order : undefined;
  if (id === undefined) warnings.push(`${where}: id assigned ${index + 1}`);
  out.id = id ?? index + 1;
  const kind = asString(s.kind) ?? asString(s.type);
  if (!kind || !STEP_KINDS.includes(kind)) {
    warnings.push(`${where}: kind defaulted to pencil`);
    out.kind = 'pencil';
  } else {
    if (!asString(s.kind)) warnings.push(`${where}: type -> kind`);
    out.kind = kind;
  }
  if (!asString(s.layer)) {
    warnings.push(`${where}: layer defaulted to construction`);
    out.layer = 'construction';
  }
  if (Array.isArray(s.strokes)) {
    out.strokes = s.strokes
      .map((st, i) => normalizeStroke(st, `${where}.strokes[${i}]`, warnings))
      .filter((x): x is Record<string, unknown> => x !== null);
  }
  if (Array.isArray(s.fills)) {
    const kept = s.fills.filter((f) => isObj(f) && asString(f.path) && asString(f.color));
    if (kept.length !== s.fills.length) warnings.push(`${where}: dropped ${s.fills.length - kept.length} fills without path/color`);
    out.fills = kept;
  }
  return out;
}

function normalizeBone(b: unknown, index: number, warnings: string[]): Record<string, unknown> | null {
  if (!isObj(b)) return null;
  const name = asString(b.name) ?? asString(b.joint) ?? asString(b.bone);
  const from = asNumPair(b.from) ?? asNumPair(b.start) ?? asNumPair(b.a);
  const to = asNumPair(b.to) ?? asNumPair(b.end) ?? asNumPair(b.b);
  if (!name || !from || !to) {
    warnings.push(`rig.bones[${index}]: dropped (needs name/from/to)`);
    return null;
  }
  if (!asString(b.name)) warnings.push(`rig.bones[${index}]: joint/start/end -> name/from/to`);
  return { name, from, to };
}

export function normalizeScript(raw: unknown): NormalizeResult {
  if (!isObj(raw)) throw new Error('model response is not a JSON object');
  const warnings: string[] = [];
  const out: Record<string, unknown> = { ...raw };

  if (isObj(raw.style)) {
    const style: Record<string, unknown> = { ...(raw.style as Record<string, unknown>) };
    const pal = (raw.style as Record<string, unknown>).palette;
    if (Array.isArray(pal)) {
      const kept = pal.filter((c) => typeof c === 'string');
      if (kept.length !== pal.length) warnings.push('style.palette: dropped non-string entries');
      style.palette = kept;
    } else if (isObj(pal)) {
      style.palette = Object.values(pal).filter((c) => typeof c === 'string');
      warnings.push(`style.palette: object -> array (${(style.palette as string[]).length} colors)`);
    }
    for (const key of ['linePencil', 'lineInk'] as const) {
      const v = (raw.style as Record<string, unknown>)[key];
      if (typeof v !== 'string' && isObj(v)) {
        const color = asString(v.color) ?? asString(v.value);
        if (color) {
          style[key] = color;
          warnings.push(`style.${key}: object -> "${color}"`);
        }
      }
    }
    out.style = style;
  }

  if (Array.isArray(raw.steps)) {
    out.steps = raw.steps.map((s, i) => normalizeStep(s, i, warnings));
  }

  if (isObj(raw.rig)) {
    const rig: Record<string, unknown> = { ...(raw.rig as Record<string, unknown>) };
    const r = raw.rig as Record<string, unknown>;
    if (Array.isArray(r.bones)) {
      rig.bones = r.bones
        .map((b, i) => normalizeBone(b, i, warnings))
        .filter((x): x is Record<string, unknown> => x !== null);
    }
    if (Array.isArray(r.morphTargets)) {
      rig.morphTargets = r.morphTargets;
    } else if (isObj(r.morphTargets)) {
      rig.morphTargets = Object.values(r.morphTargets).filter((v) => typeof v === 'string');
      warnings.push('rig.morphTargets: object -> array');
    } else if (typeof r.morphTargets === 'string') {
      rig.morphTargets = [r.morphTargets];
      warnings.push('rig.morphTargets: string -> array');
    }
    out.rig = rig;
  }

  if (isObj(raw.anim)) {
    const anim: Record<string, unknown> = { ...(raw.anim as Record<string, unknown>) };
    const loop = (raw.anim as Record<string, unknown>).loop;
    if (typeof loop !== 'string') {
      anim.loop = 'idle';
      warnings.push('anim.loop: non-string -> "idle"');
    }
    out.anim = anim;
  }

  return { script: out, warnings };
}
