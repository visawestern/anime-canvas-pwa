import { ZodError } from 'zod';
import { requestElementList, type DecomposeKind } from '@/lib/ollama-server';
import { summarizeIssues } from '@/lib/lesson-pipeline';

const KINDS: DecomposeKind[] = ['scene', 'item'];

export async function POST(req: Request): Promise<Response> {
  let body: { kind?: unknown; prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  if (typeof body.kind !== 'string' || !KINDS.includes(body.kind as DecomposeKind)) {
    return Response.json({ error: `kind must be one of: ${KINDS.join(', ')}` }, { status: 400 });
  }
  if (typeof body.prompt !== 'string' || body.prompt.trim() === '') {
    return Response.json({ error: 'prompt is required' }, { status: 400 });
  }
  try {
    const list = await requestElementList({ kind: body.kind as DecomposeKind, prompt: body.prompt });
    return Response.json(list, { status: 200 });
  } catch (e) {
    if (e instanceof ZodError) {
      return Response.json(
        {
          error: `model output failed schema: ${summarizeIssues(e.issues)}`,
          violations: e.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
        },
        { status: 422 },
      );
    }
    return Response.json({ error: `ollama unavailable: ${(e as Error).message}` }, { status: 502 });
  }
}
