import { ZodError } from 'zod';
import { requestDrawingScript } from '@/lib/ollama-server';
import { validatePipeline, summarizeIssues } from '@/lib/lesson-pipeline';

export async function POST(req: Request): Promise<Response> {
  let body: { imageBase64?: unknown; prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  if (typeof body.imageBase64 !== 'string' || body.imageBase64.trim() === '') {
    return Response.json({ error: 'imageBase64 is required' }, { status: 400 });
  }
  try {
    const script = await requestDrawingScript({
      imageBase64: body.imageBase64,
      prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
    });
    const violations = validatePipeline(script);
    if (violations.length > 0) {
      const shown = violations.slice(0, 5).join('; ');
      const more = violations.length > 5 ? ` ... and ${violations.length - 5} more` : '';
      return Response.json(
        { error: `lesson pipeline violated: ${shown}${more}`, violations },
        { status: 422 },
      );
    }
    return Response.json(script, { status: 200 });
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
