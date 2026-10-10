import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestDrawingScript } from '@/lib/ollama-server';

const validScript = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['construction', 'ink'],
  steps: [{ id: 1, kind: 'pencil', layer: 'construction', strokes: [{ path: 'M0 0 L10 10' }] }],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'x', dirtyLayers: [] },
};

describe('requestDrawingScript (server)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses fenced JSON and validates schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: '```json\n' + JSON.stringify(validScript) + '\n```' } }) })) as never,
    );
    const script = await requestDrawingScript({ imageBase64: 'AAA' });
    expect(script.anim.fps).toBe(12);
    expect(script.steps).toHaveLength(1);
  });

  it('throws honest error on HTTP failure (no fake script)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' })) as never);
    await expect(requestDrawingScript({ imageBase64: 'AAA' })).rejects.toThrow(/ollama error 500/);
  });

  it('throws honest error when daemon unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch failed');
      }) as never,
    );
    await expect(requestDrawingScript({ imageBase64: 'AAA' })).rejects.toThrow(/unreachable/);
  });

  it('rejects schema-invalid model output (never renders garbage)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: '{"steps":[]}' } }) })) as never,
    );
    await expect(requestDrawingScript({ imageBase64: 'AAA' })).rejects.toThrow();
  });

  it('throws on missing message payload (no silent empty script)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })) as never);
    await expect(requestDrawingScript({ imageBase64: 'AAA' })).rejects.toThrow(/no JSON/);
  });
});
