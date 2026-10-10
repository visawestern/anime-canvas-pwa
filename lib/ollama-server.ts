import { buildChatRequest, buildTextRequest, parseModelJson } from './ollama';
import { buildKindPrompt, type GenerateKind } from './generate-prompts';
import { DrawingScriptSchema, type DrawingScript } from './drawing-script-schema';
import { ANIME_DIRECTOR_PROMPT } from './anime-director-prompt';

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma4:31b-cloud';

/** Server-only: text prompt -> DrawingScript for character/item/location/scene. Never fakes. */
export async function requestDrawingScriptFromPrompt(args: {
  kind: GenerateKind;
  prompt: string;
  model?: string;
}): Promise<DrawingScript> {
  const body = buildTextRequest({
    prompt: buildKindPrompt(args.kind, args.prompt),
    model: args.model || OLLAMA_MODEL,
  });
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`ollama unreachable at ${OLLAMA_HOST}: ${(e as Error).message}`);
  }
  if (!res.ok) throw new Error(`ollama error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return DrawingScriptSchema.parse(parseModelJson(data.message?.content ?? ''));
}

/** Server-only: sends image to Gemma vision, validates DrawingScript JSON. Never fakes pixels. */
export async function requestDrawingScript(args: {
  imageBase64: string;
  prompt?: string;
  model?: string;
}): Promise<DrawingScript> {
  const body = buildChatRequest({
    imageBase64: args.imageBase64,
    prompt: `${ANIME_DIRECTOR_PROMPT}\n\nUser task: ${args.prompt || 'Analyze the photo and produce a DrawingScript to redraw it as anime on canvas.'}`,
    model: args.model || OLLAMA_MODEL,
  });
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`ollama unreachable at ${OLLAMA_HOST}: ${(e as Error).message}`);
  }
  if (!res.ok) throw new Error(`ollama error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { message?: { content?: string } };
  const parsed = parseModelJson(data.message?.content ?? '');
  return DrawingScriptSchema.parse(parsed);
}
