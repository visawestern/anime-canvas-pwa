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

describe('requestDrawingScript repair-retry', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  const fullValid = {
    style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
    layers: ['construction', 'ink', 'fill'],
    steps: [
      { id: 1, kind: 'pencil', layer: 'construction', strokes: [{ path: 'M0 0 L10 10', w: 1.2, o: 0.5 }] },
      { id: 2, kind: 'ink', layer: 'ink', strokes: [{ path: 'M0 0 L10 10', w: 2.4, o: 1 }] },
      { id: 3, kind: 'fill', layer: 'fill', fills: [{ path: 'M0 0 L10 0 L10 10 Z', color: '#fff' }] },
    ],
    rig: { bones: [], morphTargets: [] },
    anim: { fps: 12, loop: 'idle', dirtyLayers: [] },
  };

  function chatWith(content: string) {
    return { ok: true, json: async () => ({ message: { content } }) };
  }

  it('repairs invalid output on retry: second request carries the error list', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => chatWith('{"steps":[]}'));
    fetchMock.mockResolvedValueOnce(chatWith('{"steps":[]}'));
    fetchMock.mockResolvedValueOnce(chatWith(JSON.stringify(fullValid)));
    vi.stubGlobal('fetch', fetchMock as never);
    const script = await requestDrawingScript({ imageBase64: 'AAA' });
    expect(script.steps).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as unknown as RequestInit).body as string) as {
      messages: { content: string }[];
    };
    expect(secondBody.messages.length).toBeGreaterThan(1);
    expect(secondBody.messages.map((m) => m.content).join('\n')).toMatch(/fix|error|issue|исправь/i);
  });

  it('throws a bounded summary after exhausting tries (no 70-issue dump)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => chatWith('{"steps":[]}')) as never);
    const err = (await requestDrawingScript({ imageBase64: 'AAA' }).catch((e: unknown) => e)) as Error;
    expect(err.message).toMatch(/attempt|попыт/i);
    expect(err.message.length).toBeLessThan(2000);
  });

  it('normalizes drifted keys without a retry (style objects, d/points, ids, bones, loop)', async () => {
    const drifted = {
      style: { palette: { a: '#fff' }, linePencil: { color: '#666' }, lineInk: { color: '#111' } },
      layers: ['construction', 'ink', 'fill'],
      steps: [
        { kind: 'pencil', layer: 'construction', strokes: [{ d: 'M0 0 L10 10', w: 1.2, o: 0.5 }] },
        { n: 2, kind: 'ink', layer: 'ink', strokes: [{ points: [[0, 0], [10, 10]], w: 2.4, o: 1 }] },
        { id: 3, kind: 'fill', layer: 'fill', fills: [{ path: 'M0 0 L10 0 L10 10 Z', color: '#fff' }] },
      ],
      rig: { bones: [{ joint: 'arm', start: [0, 0], end: [1, 1] }], morphTargets: { h: 'wave' } },
      anim: { fps: 12, loop: false, dirtyLayers: [] },
    };
    const fetchMock = vi.fn(async () => chatWith(JSON.stringify(drifted)));
    vi.stubGlobal('fetch', fetchMock as never);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const script = await requestDrawingScript({ imageBase64: 'AAA' });
      expect(script.steps.map((s) => s.id)).toEqual([1, 2, 3]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
