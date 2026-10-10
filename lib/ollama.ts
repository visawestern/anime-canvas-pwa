export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  format: 'json';
  stream: false;
}

export function buildChatRequest(args: { imageBase64: string; prompt: string; model: string }): ChatRequest {
  const imageBase64 = (args.imageBase64 ?? '').trim();
  if (!imageBase64) throw new Error('imageBase64 is required (no fake drawing without input image)');
  if (!args.model) throw new Error('model is required');
  return {
    model: args.model,
    format: 'json',
    stream: false,
    messages: [{ role: 'user', content: args.prompt, images: [imageBase64] }],
  };
}

/** Prompt-only request (new character/item/location/scene from text, no photo). */
export function buildTextRequest(args: { prompt: string; model: string }): ChatRequest {
  const prompt = (args.prompt ?? '').trim();
  if (!prompt) throw new Error('prompt is required (no fake generation from empty prompt)');
  if (!args.model) throw new Error('model is required');
  return { model: args.model, format: 'json', stream: false, messages: [{ role: 'user', content: prompt }] };
}

/** Extract JSON object from raw model text (raw or ```json fenced). Throws on non-JSON. */export function parseModelJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('model response contains no JSON object');
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new Error('model response is not valid JSON');
  }
}
