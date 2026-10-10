import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/rasterize', () => ({
  svgToPngBase64: vi.fn(async () => 'AAA'),
}));

import { remixReferencePiece } from '@/lib/remix';
import { svgToPngBase64 } from '@/lib/rasterize';

const script = {
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

describe('remixReferencePiece (reference auto-substituted into vision)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(svgToPngBase64).mockResolvedValue('AAA');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => script })) as never);
  });

  it('rasterizes the piece and sends it to the vision endpoint with the brief', async () => {
    const out = await remixReferencePiece({
      svgText: '<svg viewBox="0 0 10 10"></svg>',
      name: 'katana-01',
      extraPrompt: 'сделать рукоять красной',
    });
    expect(out.imageBase64).toBe('AAA');
    expect(out.script.steps).toHaveLength(3);
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.imageBase64).toBe('AAA');
    expect(body.prompt).toContain('katana-01');
    expect(body.prompt).toContain('красной');
  });

  it('never calls the model when rasterization fails', async () => {
    vi.mocked(svgToPngBase64).mockRejectedValue(new Error('no browser'));
    await expect(
      remixReferencePiece({ svgText: '<svg></svg>', name: 'x', extraPrompt: 'y' }),
    ).rejects.toThrow(/browser/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces server errors honestly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({ error: 'model failed' }) })) as never,
    );
    await expect(
      remixReferencePiece({ svgText: '<svg></svg>', name: 'x', extraPrompt: 'y' }),
    ).rejects.toThrow(/model failed/);
  });
});
