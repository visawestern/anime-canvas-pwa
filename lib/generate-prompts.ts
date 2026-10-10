/** Kind-specific director briefs: text prompt -> DrawingScript JSON. Grounded in risunci lessons. */
import { lessonBlock, exampleBlock } from './lesson-knowledge';
import { svgCraftBlock, lineArtBlock } from './svg-craft';

export type GenerateKind = 'character' | 'item' | 'location' | 'scene';

const BASE = `Output ONLY a DrawingScript JSON object (no prose, no markdown).
Schema: style {palette, linePencil, lineInk}, layers [strings], steps (non-empty, kinds only pencil|ink|eraser|fill|shade), rig {bones, morphTargets}, anim {fps 1..24, loop, dirtyLayers subset of layers}.
Strokes use SVG path data (absolute M/L/C/Z) in a 0..512 viewBox. Construction order: pose axis -> skeleton -> masses -> details -> ink -> eraser -> fill -> cel shade.

${lessonBlock()}

${svgCraftBlock()}

${lineArtBlock()}

${exampleBlock()}`;

export const KIND_PROMPTS: Record<GenerateKind, string> = {
  character: `${BASE}
Task: new anime CHARACTER full-body. Head: circle with extended chin; big expressive eyes with highlights, nose hint, mouth; hair from hairline point with flowing strands; neck+collar; torso chest->waist->hips accent (natural, never globe-like); arms/hands with elbow bump, wrist+fingers in highest detail, nearer arm larger (perspective); outfit with folds; confident ink contour; erase construction; flat fills + 2-tone cel shading + blush.
anim.dirtyLayers: only moving parts (hair, arms, magic). Layers must include construction, head, face, hair_back, body, arms, ink, fill, shade.`,
  item: `${BASE}
Task: new anime ITEM (weapon/tool/artifact) as clean turnaround object: construction axes -> silhouette masses -> edge details, engravings, glow runes -> ink -> erase -> flat fills + cel shade + optional glow (lighter composite shapes in shade layer).
Keep it centered, single object, no character, no background. Layers must include construction, silhouette, details, ink, fill, shade.`,
  location: `${BASE}
Task: new anime LOCATION backdrop (no characters): horizon/perspective guides -> large masses (sky, mountains, architecture) -> mid details (windows, trees, lanterns) -> foreground accents -> ink -> erase -> flat fills + atmospheric cel shade + light glow spots.
Wide composition, depth in 3 planes. Layers must include construction, sky, mid, foreground, ink, fill, shade.`,
  scene: `${BASE}
Task: new anime SCENE with cast (actors) and items on a location. The user prompt below lists the cast with their looks and the action.
Compose: location backdrop masses first (sky/mid/foreground), then place each actor by the risunci full-body order (pose axis, skeleton, head/face/hair, torso, arms/hands with finger detail), then items in hands or on set, interactions between actors; ink all -> erase construction -> fills + cel shade + magic/light effects.
anim: fps 12, loop describing the living motion, dirtyLayers ONLY the moving parts (never whole actors or background). Layers must include construction, backdrop, one layer per actor (actor_<name>), items, ink, fill, shade.`,
};

/** Wrap user prompt into the kind template. Empty prompts rejected — never generate from nothing. */
export function buildKindPrompt(kind: GenerateKind, userPrompt: string): string {
  const clean = (userPrompt ?? '').trim();
  if (!clean) throw new Error('prompt is required');
  const template = KIND_PROMPTS[kind];
  if (!template) throw new Error(`unknown kind: ${kind}`);
  return `${template}\n\nUser prompt: ${clean}`;
}
