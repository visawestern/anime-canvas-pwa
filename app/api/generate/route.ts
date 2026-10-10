import { requestDrawingScriptFromPrompt } from '@/lib/ollama-server';
import { KIND_PROMPTS, type GenerateKind } from '@/lib/generate-prompts';
import { validatePipeline } from '@/lib/lesson-pipeline';

const KINDS = Object.keys(KIND_PROMPTS) as GenerateKind[];

export async function POST(req: Request): Promise<Response> {
  let body: { kind?: unknown; prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  if (typeof body.kind !== 'string' || !KINDS.includes(body.kind as GenerateKind)) {
    return Response.json({ error: `kind must be one of: ${KINDS.join(', ')}` }, { status: 400 });
  }
  if (typeof body.prompt !== 'string' || body.prompt.trim() === '') {
    return Response.json({ error: 'prompt is required' }, { status: 400 });
  }
  try {
    const script = await requestDrawingScriptFromPrompt({
      kind: body.kind as GenerateKind,
      prompt: body.prompt,
    });
    const violations = validatePipeline(script);
    if (violations.length > 0) {
      return Response.json(
        { error: `lesson pipeline violated: ${violations.join('; ')}`, violations },
        { status: 422 },
      );
    }
    return Response.json(script, { status: 200 });
  } catch (e) {
    return Response.json({ error: `ollama unavailable: ${(e as Error).message}` }, { status: 502 });
  }
}
