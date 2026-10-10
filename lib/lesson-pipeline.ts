import type { DrawingScript } from './drawing-script-schema';
import type { ZodIssue } from 'zod';
import { snapStrokeToGrade } from './lesson-knowledge';

/**
 * Lesson pipeline gate: every model-produced DrawingScript must draw like the lessons teach.
 * Returns violation messages (empty = draws correctly). Never auto-fixes — violations surface as 422.
 */
export function validatePipeline(script: DrawingScript): string[] {
  const violations: string[] = [];
  const steps = script.steps;
  if (!steps || steps.length === 0) return ['script has no steps: nothing to draw'];

  for (let i = 1; i < steps.length; i++) {
    if (steps[i].id <= steps[i - 1].id) {
      violations.push(`film order broken: step id ${steps[i].id} after ${steps[i - 1].id} (ids must ascend)`);
      break;
    }
  }

  if (steps[0].kind !== 'pencil') {
    violations.push('must start with pencil construction (all lessons begin with general forms)');
  }
  if (!steps.some((s) => s.kind === 'ink')) {
    violations.push('no ink step: drawing never finished with confident contour');
  }

  const drawnLayers = new Set<string>();
  for (const s of steps) {
    if (s.kind === 'eraser' && (s.strokes ?? []).length > 0 && !drawnLayers.has(s.layer)) {
      violations.push(`eraser over never-drawn layer "${s.layer}"`);
    }
    if (s.kind !== 'eraser') {
      for (const st of s.strokes ?? []) {
        // snap-tolerant: near-misses were already snapped by normalize; only garbage fails
        if (!snapStrokeToGrade(st.w ?? 1.5, st.o ?? 1)) {
          violations.push(
            `step ${s.id}: stroke w=${st.w ?? 1.5} o=${st.o ?? 1} outside every pencil grade (HB->B6 bands)`,
          );
        }
      }
    }
    if ((s.kind === 'fill' || s.kind === 'shade') && (s.fills ?? []).length === 0 && (s.strokes ?? []).length === 0) {
      violations.push(`step ${s.id}: ${s.kind} without fills or strokes draws nothing`);
    }
    if ((s.strokes ?? []).length > 0) drawnLayers.add(s.layer);
  }
  return violations;
}

/** Scene cast consistency: every actor must own a layer (prompt demands actor_<name> layers). */
export function validateSceneLayers(script: DrawingScript, characters: string[]): string[] {
  const layers = script.layers.map((l) => l.toLowerCase());
  return characters.filter((name) => {
    const variants = [name.toLowerCase(), transliterate(name, 'y'), transliterate(name, 'i')];
    return !variants.some((v) => v && layers.some((l) => l.includes(v)));
  });
}

const RU_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** Russian->latin for layer matching (live models transliterate actor_Ая to actor_aya). */
export function transliterate(s: string, jot: 'y' | 'i' = 'y'): string {
  return s
    .toLowerCase()
    .split('')
    .map((ch) => (ch === 'й' ? jot : (RU_MAP[ch] ?? ch)))
    .join('');
}

/** Bounded human summary of schema issues: first 5 + count (never the full dump). */
export function summarizeIssues(issues: ZodIssue[], max = 5): string {
  const lines = issues
    .slice(0, max)
    .map((i) => `${i.path.length > 0 ? i.path.join('.') : '(root)'}: ${i.message}`);
  const more = issues.length > max ? ` ... and ${issues.length - max} more` : '';
  return lines.join('; ') + more;
}
