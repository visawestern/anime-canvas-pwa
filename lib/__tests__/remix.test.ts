import { describe, it, expect, vi, beforeEach } from 'vitest';
import { remixReferencePiece } from '@/lib/remix';

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

const pieceSvg = '<svg viewBox="0 0 100 50"><g id="blade"><path d="M0 0 L90 10"/></g></svg>';

describe('remixReferencePiece (SVG template as text, no raster)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => script })) as never);
  });

  it('sends the piece markup + brief + changes as one text prompt', async () => {
    const out = await remixReferencePiece({
      svgText: pieceSvg,
      name: 'katana-01',
      extraPrompt: 'красная рукоять',
    });
    expect(out.script.steps).toHaveLength(3);
    expect(out.svgText).toBe(pieceSvg);
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.kind).toBe('item');
    expect(body.prompt).toContain('katana-01');
    expect(body.prompt).toContain('красная рукоять');
    expect(body.prompt).toContain('<svg');
    expect(body.prompt).toContain('M0 0 L90 10');
    expect(body.prompt).toMatch(/tsuka|brief|эталон/i);
  });

  it('rejects oversized references instead of burning tokens', async () => {
    await expect(
      remixReferencePiece({ svgText: 'x'.repeat(200001), name: 'huge', extraPrompt: 'y' }),
    ).rejects.toThrow(/too large/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces server errors honestly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({ error: 'model failed' }) })) as never,
    );
    await expect(
      remixReferencePiece({ svgText: pieceSvg, name: 'x', extraPrompt: 'y' }),
    ).rejects.toThrow(/model failed/);
  });
});
