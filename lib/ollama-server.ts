import { ZodError } from 'zod';
import { buildChatRequest, buildTextRequest, parseModelJson, type ChatMessage } from './ollama';
import { buildKindPrompt, type GenerateKind } from './generate-prompts';
import { DrawingScriptSchema, type DrawingScript } from './drawing-script-schema';
import { ANIME_DIRECTOR_PROMPT } from './anime-director-prompt';
import { normalizeScript } from './script-normalize';
import { summarizeIssues, validatePipeline } from './lesson-pipeline';

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma4:31b-cloud';
const MAX_TRIES = 3;

/** Single chat round-trip. Transport errors throw immediately (not a model mistake — no retry). */
async function postChat(model: string, messages: ChatMessage[]): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, format: 'json', stream: false, messages }),
    });
  } catch (e) {
    throw new Error(`ollama unreachable at ${OLLAMA_HOST}: ${(e as Error).message}`);
  }
  if (!res.ok) throw new Error(`ollama error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? '';
}

/**
 * Normalize -> validate, repairing with the model up to MAX_TRIES.
 * Every repair asks for JSON ONLY plus the concrete error list; persistent failure
 * throws a bounded summary (never the full 70-issue dump).
 */
async function requestWithRepair(
  label: string,
  model: string,
  initial: ChatMessage[],
  validate: (s: DrawingScript) => string[] = () => [],
): Promise<DrawingScript> {
  const messages = [...initial];
  let lastErr = 'unknown error';
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const content = await postChat(model, messages);
    try {
      const raw = parseModelJson(content);
      const { script, warnings } = normalizeScript(raw);
      for (const w of warnings) console.warn(`[${label}] normalize: ${w}`);
      const parsed = DrawingScriptSchema.parse(script);
      const violations = validate(parsed);
      if (violations.length > 0) {
        const shown = violations.slice(0, 5).join('; ');
        const more = violations.length > 5 ? ` ... and ${violations.length - 5} more` : '';
        throw new Error(`lesson pipeline violated: ${shown}${more}`);
      }
      return parsed;
    } catch (e) {
      lastErr = e instanceof ZodError ? `schema: ${summarizeIssues(e.issues)}` : (e as Error).message;
      messages.push(
        { role: 'assistant', content },
        {
          role: 'user',
          content: `Your previous reply was invalid (attempt ${attempt}/${MAX_TRIES}). Fix these errors and reply with JSON ONLY in the same DrawingScript shape:\n${lastErr}`,
        },
      );
    }
  }
  throw new Error(`model failed after ${MAX_TRIES} attempts: ${lastErr}`);
}

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
  return requestWithRepair(`generate:${args.kind}`, body.model, body.messages, validatePipeline);
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
  return requestWithRepair('draw:photo', body.model, body.messages, validatePipeline);
}
