import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ollama-server', () => ({
  requestDrawingScript: vi.fn(),
  requestDrawingScriptFromPrompt: vi.fn(),
}));

import { POST } from '@/app/api/generate/route';
import { requestDrawingScriptFromPrompt } from '@/lib/ollama-server';
import { DrawingScriptSchema } from '@/lib/drawing-script-schema';

function req(body: unknown) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const lessonScript = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['construction', 'ink', 'fill'],
  steps: [
    { id: 1, kind: 'pencil', layer: 'construction', strokes: [{ path: 'M0 0 L10 10', w: 1.2, o: 0.5 }] },
    { id: 2, kind: 'ink', layer: 'ink', strokes: [{ path: 'M0 0 L10 10', w: 2.4, o: 1 }] },
    { id: 3, kind: 'fill', layer: 'fill', fills: [{ path: 'M0 0 L10 0 L10 10 Z', color: '#fff' }] },
  ],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'x', dirtyLayers: [] },
};

describe('POST /api/generate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 400 for unknown kind', async () => {
    const res = await POST(req({ kind: 'dragon', prompt: 'x' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty prompt', async () => {
    const res = await POST(req({ kind: 'character', prompt: '  ' }));
    expect(res.status).toBe(400);
  });

  it('returns script for character prompt', async () => {
    vi.mocked(requestDrawingScriptFromPrompt).mockResolvedValue(lessonScript as never);
    const res = await POST(req({ kind: 'character', prompt: 'девочка-волшебница' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(lessonScript);
    expect(vi.mocked(requestDrawingScriptFromPrompt).mock.calls[0][0]).toMatchObject({
      kind: 'character',
      prompt: 'девочка-волшебница',
    });
  });

  it('returns 422 when model output breaks the lesson pipeline', async () => {
    const noInk = { ...lessonScript, steps: [lessonScript.steps[0], lessonScript.steps[2]] };
    vi.mocked(requestDrawingScriptFromPrompt).mockResolvedValue(noInk as never);
    const res = await POST(req({ kind: 'character', prompt: 'герой' }));
    expect(res.status).toBe(422);
  });

  it('returns 502 when Ollama fails (no fake pixels)', async () => {
    vi.mocked(requestDrawingScriptFromPrompt).mockRejectedValue(new Error('down'));
    const res = await POST(req({ kind: 'scene', prompt: 'битва' }));
    expect(res.status).toBe(502);
  });

  it('returns 422 (not 502) when model output fails schema', async () => {
    let zodErr: unknown;
    try {
      DrawingScriptSchema.parse({});
    } catch (e) {
      zodErr = e;
    }
    vi.mocked(requestDrawingScriptFromPrompt).mockRejectedValue(zodErr);
    const res = await POST(req({ kind: 'character', prompt: 'герой' }));
    expect(res.status).toBe(422);
  });
});
