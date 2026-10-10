import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ollama-server', () => ({
  requestDrawingScript: vi.fn(),
}));

import { POST } from '@/app/api/draw/route';
import { requestDrawingScript } from '@/lib/ollama-server';

function req(body: unknown) {
  return new Request('http://localhost/api/draw', {
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

describe('POST /api/draw', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 400 when imageBase64 missing', async () => {
    const res = await POST(req({ prompt: 'hi' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on malformed JSON body', async () => {
    const bad = new Request('http://localhost/api/draw', { method: 'POST', body: 'not-json{{{' });
    const res = await POST(bad);
    expect(res.status).toBe(400);
  });

  it('returns script JSON on success', async () => {
    vi.mocked(requestDrawingScript).mockResolvedValue(lessonScript as never);
    const res = await POST(req({ imageBase64: 'AAA', prompt: 'draw anime' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(lessonScript);
  });

  it('returns 422 when model output breaks the lesson pipeline (no fake render)', async () => {
    const noConstruction = { ...lessonScript, steps: lessonScript.steps.slice(1) };
    vi.mocked(requestDrawingScript).mockResolvedValue(noConstruction as never);
    const res = await POST(req({ imageBase64: 'AAA' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/pipeline|construction|pencil/i);
    expect(Array.isArray(body.violations)).toBe(true);
  });

  it('returns 502 when Ollama unreachable (no silent fake)', async () => {
    vi.mocked(requestDrawingScript).mockRejectedValue(new Error('connect ECONNREFUSED'));
    const res = await POST(req({ imageBase64: 'AAA' }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/ollama/i);
  });
});
