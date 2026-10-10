/**
 * SVG craft distilled from the logo-design skill (principles, svg-construction,
 * visual-techniques) and adapted to anime DrawingScript generation on a 512 canvas:
 * geometric discipline, anchor economy, exact angles, micro-detail and color rules,
 * optical corrections. Wired into prompts (svgCraftBlock) and measured (auditCraft,
 * the local analogue of the skill's svg_audit.py).
 */
import type { DrawingScript } from './drawing-script-schema';
import { svgPathToPoints } from './pencil-renderer';
import type { Point } from './pencil-engine';

export const SVG_CRAFT_RULES: string[] = [
  '512 viewBox discipline: integer or 1-2 decimal coordinates, even padding, one layer per part',
  'Exact whole-number angles (0/15/30/45/60/90): near-misses read as mistakes, not style',
  'Arcs (A) for circular geometry with consistent radii; anchors at curve extrema, few anchors per path',
  'Consistent stroke widths per pencil grade; filled shapes always closed with Z',
  'Max 4 flat fill colors; no micro-details below 1/64 of the canvas (8 units on 512)',
  'Optical corrections: round/pointed forms overshoot straight lines by 1-3%, horizontals a touch thinner, optical center slightly high',
  'Few shading tones (highlight/mid/shadow); every decision must survive small sizes — no hairlines',
  'Short coordinate strings: integers preferred, max 2 decimals (exact and light geometry)',
];

export function svgCraftBlock(): string {
  const lines = SVG_CRAFT_RULES.map((r, i) => `${i + 1}. ${r}.`);
  return ['SVG CRAFT (distilled logo discipline — draw like a vector professional, not a sketch bot):', ...lines].join('\n');
}

/**
 * LINE ART + COLOR (Wikimedia Anime_Girl reference + Surbhi write-on film, two phases):
 * Phase 1 draws strokes only (one <g> per part, sequenced by unique step ids);
 * Phase 2 fades Gemma's flat colors in (fillin) per <g> — fills carry CORRECT final colors.
 */export function lineArtBlock(): string {
  return [
    'LINE ART + COLOR in two phases (Anime_Girl reference + Surbhi write-on):',
    'Phase 1 — pencil write-on, strokes only: one <g> per part (actor_<name>, hair, face...), finish each <g> fully before the next; unique step ids sequence the film like Surbhi path ids with delays.',
    'Phase 2 — fillin: every fill carries its CORRECT final flat color and fades in after its <g> outlines are drawn; shading ONLY with B-family hatching strokes plus these flat fills, never gradients.',
    'Retrace outer contours sharp and confident like the Anime_Girl reference; hair masses behind eyes, brows over hair.',
  ].join('\n');
}

/**
 * DECOMPOSE every subject into named closed-contour parts in z-order (back-to-front):
 * sword = handle, blade, engraving; scene = sky, ground, buildings, roads, actors.
 * Parts become separately generatable, movable and recolorable units (thousands of combos).
 */
export function partsBlock(): string {
  return [
    'DECOMPOSE into named parts, one <g> per part, back-to-front z-order:',
    '- Characters/items: split into components (sword: handle FIRST, then blade, then engraving/hieroglyphs on the blade; figure: head, hair, torso, arms, outfit) — each component its own closed contours, combinable across generations.',
    '- Scenes: landscape FIRST (sky, distant ground), then midground (buildings, trees), then roads/paths, then actors and items LAST (front). Never draw front elements before their background.',
    '- Every step sets part: "handle" | "blade" | "sky" | "actor_<name>"... — parts draw in document order = z-order (first painted = rearmost).',
    '- Closed contours: outlines return to start (Z); fills closed; each part self-contained with no stray lines into other parts.',
  ].join('\n');
}

export interface CraftFinding {
  rule: string;
  detail: string;
}

export interface CraftAudit {
  score: number;
  findings: CraftFinding[];
}

const MAX_ANCHORS_PER_PATH = 48;
const MAX_ANCHORS_TOTAL = 500;
const MICRO = 8;
const MAX_COLORS = 4;
const MIN_SEGMENT = 16;
const CLEAN_ANGLES = [0, 15, 30, 45];
const MISS_LO = 0.3;
const MISS_HI = 3;

function countAnchors(d: string): number {
  return (d.match(/-?\d*\.?\d+/g) ?? []).length / 2;
}

function hasOverPrecise(d: string): boolean {
  return /\d+\.\d{3,}/.test(d);
}

/** Distance to the nearest clean angle with 90° symmetry + 45° mirror (75° counts as 15°). */
function angleDist(x0: number, y0: number, x1: number, y1: number): number {
  const deg = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  let f = ((deg % 90) + 90) % 90;
  if (f > 45) f = 90 - f;
  return Math.min(...CLEAN_ANGLES.map((t) => Math.abs(f - t)));
}

function bbox(pts: Point[]): { w: number; h: number } {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** Score generated art like svg_audit.py: anchors, micro-details, colors, angles, closure. */
export function auditCraft(script: DrawingScript): CraftAudit {
  const findings: CraftFinding[] = [];
  const steps = script.steps ?? [];
  if (steps.length === 0) return { score: 0, findings: [{ rule: 'empty', detail: 'no steps to audit' }] };
  let totalAnchors = 0;
  const colors = new Set<string>();
  const angleMisses: string[] = [];

  for (const s of steps) {
    for (const st of s.strokes ?? []) {
      const d = typeof st.path === 'string' ? st.path : '';
      const anchors = countAnchors(d);
      totalAnchors += anchors;
      if (anchors > MAX_ANCHORS_PER_PATH) {
        findings.push({ rule: 'anchors', detail: `step ${s.id}: ${anchors} anchors in one path (lumpy-curve risk)` });
      }
      if (hasOverPrecise(d)) {
        findings.push({ rule: 'precision', detail: `step ${s.id}: 3+ decimals (integers preferred, max 2)` });
      }
      let pts: Point[] | null = null;
      try {
        pts = svgPathToPoints(d);
      } catch {
        findings.push({ rule: 'unparseable', detail: `step ${s.id}: unparseable path, cannot audit geometry` });
        continue;
      }
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        if (Math.hypot(x1 - x0, y1 - y0) < MIN_SEGMENT) continue;
        const dist = angleDist(x0, y0, x1, y1);
        if (dist >= MISS_LO && dist <= MISS_HI) {
          angleMisses.push(`step ${s.id}: ${dist.toFixed(1)}° off a clean angle`);
        }
      }
    }
    for (const f of s.fills ?? []) {
      const d = typeof f.path === 'string' ? f.path : '';
      const anchors = countAnchors(d);
      totalAnchors += anchors;
      if (anchors > MAX_ANCHORS_PER_PATH) {
        findings.push({ rule: 'anchors', detail: `step ${s.id}: ${anchors} anchors in one fill (simplify)` });
      }
      // fills are legitimate Phase-2 color (no line-art finding); still check geometry below
      if (hasOverPrecise(d)) {
        findings.push({ rule: 'precision', detail: `step ${s.id}: 3+ decimals in fill (max 2)` });
      }
      let pts: Point[] | null = null;
      try {
        pts = svgPathToPoints(d);
      } catch {
        findings.push({ rule: 'unparseable', detail: `step ${s.id}: unparseable fill path` });
        continue;
      }
      const { w, h } = bbox(pts);
      if (w < MICRO && h < MICRO) {
        findings.push({ rule: 'tiny', detail: `step ${s.id}: micro-detail below 1/64 (${w.toFixed(1)}x${h.toFixed(1)})` });
      }
      if (!/[zZ]$/.test(d.trim())) {
        findings.push({ rule: 'unclosed', detail: `step ${s.id}: fill not closed with Z` });
      }
      if (typeof f.color === 'string') colors.add(f.color.toLowerCase());
    }
  }
  if (totalAnchors > MAX_ANCHORS_TOTAL) {
    findings.push({ rule: 'complexity', detail: `${totalAnchors} anchors total (simplify masses)` });
  }
  if (colors.size > MAX_COLORS) {
    findings.push({ rule: 'colors', detail: `${colors.size} fill colors (max ${MAX_COLORS} flat)` });
  }
  if (angleMisses.length > 0) {
    const shown = angleMisses.slice(0, 3).join('; ');
    const more = angleMisses.length > 3 ? ` ... and ${angleMisses.length - 3} more` : '';
    findings.push({ rule: 'angles', detail: shown + more });
  }
  return { score: Math.max(0, 100 - 4 * findings.length), findings };
}
