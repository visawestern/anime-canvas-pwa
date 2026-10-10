import { ZodError } from 'zod';
import { buildChatRequest, buildTextRequest, parseModelJson, type ChatMessage } from './ollama';
import { buildKindPrompt, type GenerateKind } from './generate-prompts';
import { DrawingScriptSchema, type DrawingScript } from './drawing-script-schema';
import { ANIME_DIRECTOR_PROMPT } from './anime-director-prompt';
import { normalizeScript } from './script-normalize';
import { summarizeIssues, validatePipeline } from './lesson-pipeline';
import { buildDecomposePrompt, ElementListSchema, type ElementList } from './element-composer';

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
 * Generic JSON chat with model repair (up to MAX_TRIES). Transport errors throw
 * immediately; content problems (bad JSON / failed parse) trigger a repair round
 * carrying the concrete error list. Persistent failure throws a bounded summary.
 */
async function requestJson<T>(
  label: string,
  model: string,
  initial: ChatMessage[],
  parse: (raw: unknown) => T,
): Promise<T> {
  const messages = [...initial];
  let lastErr = 'unknown error';
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const content = await postChat(model, messages);
    try {
      return parse(parseModelJson(content));
    } catch (e) {
      lastErr = e instanceof ZodError ? `schema: ${summarizeIssues(e.issues)}` : (e as Error).message;
      messages.push(
        { role: 'assistant', content },
        {
          role: 'user',
          content: `Your previous reply was invalid (attempt ${attempt}/${MAX_TRIES}). Fix these errors and reply with JSON ONLY in the same shape:\n${lastErr}`,
        },
      );
    }
  }
  throw new Error(`model failed after ${MAX_TRIES} attempts: ${lastErr}`);
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
  return requestJson(label, model, initial, (raw) => {
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
  });
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

export type DecomposeKind = 'scene' | 'item';

/** Server-only: split a prompt into separately drawable elements (one request per part). */
export async function requestElementList(args: {
  kind: DecomposeKind;
  prompt: string;
  model?: string;
}): Promise<ElementList> {
  const body = buildTextRequest({
    prompt: buildDecomposePrompt(args.kind, args.prompt),
    model: args.model || OLLAMA_MODEL,
  });
  return requestJson(`decompose:${args.kind}`, body.model, body.messages, (raw) => ElementListSchema.parse(raw));
}
