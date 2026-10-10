import { svgToPngBase64 } from './rasterize';
import { KATANA_BRIEF } from './katana-reference';
import { DrawingScriptSchema, type DrawingScript } from './drawing-script-schema';

/**
 * Katana remix with the reference auto-substituted: the piece SVG is rasterized
 * in-browser and sent to Gemma vision together with the brief + user changes.
 * The user only picks a piece and describes the change — everything else is automatic.
 */
export async function remixReferencePiece(args: {
  svgText: string;
  name: string;
  extraPrompt: string;
}): Promise<{ script: DrawingScript; imageBase64: string }> {
  const imageBase64 = await svgToPngBase64(args.svgText);
  const prompt = `${KATANA_BRIEF}\n\nRemix this reference ${args.name} (attached image): ${args.extraPrompt}`;
  const res = await fetch('/api/draw', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBase64, prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'remix failed');
  return { script: DrawingScriptSchema.parse(data), imageBase64 };
}
