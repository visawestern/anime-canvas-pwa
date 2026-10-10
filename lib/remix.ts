import { KATANA_BRIEF } from './katana-reference';
import { DrawingScriptSchema, type DrawingScript } from './drawing-script-schema';

const MAX_REFERENCE_CHARS = 200000;

/**
 * Katana remix with the reference auto-substituted AS TEXT: the piece SVG markup
 * goes straight into the prompt (a language model reads SVG structure natively),
 * so it redraws following the template's groups and geometry. No rasterization.
 */
export async function remixReferencePiece(args: {
  svgText: string;
  name: string;
  extraPrompt: string;
}): Promise<{ script: DrawingScript; svgText: string }> {
  if (args.svgText.length > MAX_REFERENCE_CHARS) {
    throw new Error(`reference too large for prompt (${args.svgText.length} chars)`);
  }
  const prompt =
    `${KATANA_BRIEF}\n\nReference piece ${args.name} as SVG template ` +
    `(follow its groups and geometry closely, then apply the change):\n` +
    '```svg\n' +
    `${args.svgText}\n` +
    '```\n\n' +
    `Remix task: ${args.extraPrompt}`;
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'item', prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'remix failed');
  return { script: DrawingScriptSchema.parse(data), svgText: args.svgText };
}
