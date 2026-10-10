import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ollama-server', () => ({
  requestDrawingScript: vi.fn(),
  requestDrawingScriptFromPrompt: vi.fn(),
  requestElementList: vi.fn(),
}));

import { POST } from '@/app/api/decompose/route';
import { requestElementList } from '@/lib/ollama-server';

function req(body: unknown) {
  return new Request('http://localhost/api/decompose', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/decompose', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 400 for unknown kind or empty prompt', async () => {
    expect((await POST(req({ kind: 'dragon', prompt: 'x' }))).status).toBe(400);
    expect((await POST(req({ kind: 'scene', prompt: '  ' }))).status).toBe(400);
  });

  it('returns element list for a scene prompt', async () => {
    const list = { elements: [{ name: 'Небо', kind: 'location', prompt: 'sky' }] };
    vi.mocked(requestElementList).mockResolvedValue(list as never);
    const res = await POST(req({ kind: 'scene', prompt: 'мост на закате' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(list);
    expect(vi.mocked(requestElementList).mock.calls[0][0]).toMatchObject({ kind: 'scene' });
  });

  it('maps schema errors to 422 and transport to 502', async () => {
    const { ZodError } = await import('zod');
    const { DrawingScriptSchema } = await import('@/lib/drawing-script-schema');
    let zodErr: unknown;
    try {
      DrawingScriptSchema.parse({});
    } catch (e) {
      zodErr = e;
    }
    expect(zodErr).toBeInstanceOf(ZodError);
    vi.mocked(requestElementList).mockRejectedValue(zodErr);
    expect((await POST(req({ kind: 'item', prompt: 'меч' }))).status).toBe(422);
    vi.mocked(requestElementList).mockRejectedValue(new Error('down'));
    expect((await POST(req({ kind: 'item', prompt: 'меч' }))).status).toBe(502);
  });
});
