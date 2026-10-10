import { z } from 'zod';

export type DecomposeKind = 'scene' | 'item';

const ElementSpecSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['character', 'item', 'location']),
  prompt: z.string().min(1),
});

export const ElementListSchema = z.object({
  elements: z.array(ElementSpecSchema).min(1).max(12),
});

export type ElementSpec = z.infer<typeof ElementSpecSchema>;
export type ElementList = z.infer<typeof ElementListSchema>;

/** Ask the model to split one idea into separately drawable closed-contour elements. */
export function buildDecomposePrompt(kind: DecomposeKind, userPrompt: string): string {
  const clean = (userPrompt ?? '').trim();
  if (!clean) throw new Error('prompt is required');
  const shared = `Output ONLY JSON: {"elements": [{"name": "...", "kind": "character|item|location", "prompt": "..."}]}.
Each element is ONE drawable subject as separate closed contours, no background, no other subjects.
kind must be character, item or location. At most 8 elements.`;
  if (kind === 'scene') {
    return `${shared}
Task: split this SCENE into paint order, back-to-front: backdrop pieces first (sky, distant ground),
then midground (buildings, trees), then roads/paths, then items, then actors LAST (front).
User scene: ${clean}`;
  }
  return `${shared}
Task: split this ITEM into drawable components in build order (sword: handle FIRST with grip/pommel/guard,
then blade, then engraving/hieroglyphs on the blade; each component combinable with others).
User item: ${clean}`;
}

/** Client: ask the server to decompose a prompt (thin fetch, validated server-side). */
export async function decomposePrompt(kind: DecomposeKind, prompt: string): Promise<ElementSpec[]> {
  const res = await fetch('/api/decompose', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'decompose failed');
  return ElementListSchema.parse(data).elements;
}
