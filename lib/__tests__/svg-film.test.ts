import { describe, it, expect } from 'vitest';
import { scriptToSvg, shiftLayerMarkup } from '@/lib/svg-film';
import type { DrawingScript } from '@/lib/drawing-script-schema';

const script = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['construction', 'ink'],
  steps: [
    { id: 1, kind: 'pencil', layer: 'construction', strokes: [{ path: 'M0 0 L10 10', w: 1.2, o: 0.5 }] },
    { id: 2, kind: 'ink', layer: 'ink', strokes: [{ path: 'M0 0 L10 10', w: 2.4, o: 1 }] },
    { id: 3, kind: 'shade', layer: 'ink', fills: [{ path: 'M0 0 L10 0 L10 10 Z', color: '#fff' }] },
  ],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'idle', dirtyLayers: [] },
} as unknown as DrawingScript;

describe('scriptToSvg (Surbhi write-on film)', () => {
  it('emits one <g> per layer with unique path ids, pathLength=1, fill none', () => {
    const { svg, schedule, total } = scriptToSvg(script);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 512 512"');
    expect(svg).toContain('<g id="layer-construction">');
    expect(svg).toContain('<g id="layer-ink">');
    expect(svg.match(/<path /g)?.length).toBe(3);
    expect(svg.match(/pathLength="1"/g)?.length).toBe(3);
    expect(svg).toContain('fill="none"');
    expect(svg).toMatch(/id="s1-0"/);
    expect(svg).toMatch(/--dl:/);
    expect(svg).toMatch(/--d:/);
    expect(total).toBeGreaterThan(0);
    expect(schedule.filter((s) => s.kind === 'layer').map((s) => s.layer)).toEqual(['construction', 'ink']);
    expect(schedule[schedule.length - 1]).toMatchObject({ kind: 'fills' });
  });

  it('renders fills as contours (reference forces fill:none on everything)', () => {
    const { svg } = scriptToSvg(script);
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('M0 0 L10 0 L10 10 Z');
  });

  it('fill phase: Gemma colors fade in after strokes (draw + fillin like the reference)', () => {
    const { svg, schedule, total } = scriptToSvg(script);
    expect(svg).toContain('fill="#fff"');
    expect(svg).toContain('fill-opacity="0"');
    expect(svg).toMatch(/--fl:/);
    expect(svg).toMatch(/--fd:/);
    const fills = schedule.find((s) => s.kind === 'fills');
    expect(fills).toBeTruthy();
    expect(fills!.t).toBeGreaterThan(0);
    const strokeDelays = [...svg.matchAll(/--dl:([\d.]+)s/g)].map((m) => Number(m[1]));
    const fillDelays = [...svg.matchAll(/--fl:([\d.]+)s/g)].map((m) => Number(m[1]));
    expect(Math.min(...fillDelays)).toBeGreaterThanOrEqual(Math.max(...strokeDelays));
    expect(total).toBeGreaterThan(Math.max(...fillDelays));
  });

  it('no fills entry when the script has no fills (pure line art)', () => {
    const noFills = { ...script, steps: script.steps.filter((s) => (s as { kind: string }).kind !== 'shade') };
    const film = scriptToSvg(noFills as unknown as DrawingScript);
    expect(film.schedule.some((s) => s.kind === 'fills')).toBe(false);
  });

  it('grades set stroke width, ink draws dark like the reference pencil', () => {
    const { svg } = scriptToSvg(script);
    expect(svg).toContain('stroke-width="2.4"');
    expect(svg).toContain('stroke-width="1.2"');
  });
});

describe('shiftLayerMarkup (move a part without redrawing)', () => {
  it('translates one <g> and accumulates repeated moves, others untouched', () => {
    const { svg } = scriptToSvg(script);
    const moved = shiftLayerMarkup(svg, 'layer-ink', 10, -5);
    expect(moved).toContain('<g id="layer-ink" transform="translate(10 -5)">');
    expect(moved).not.toContain('layer-construction" transform');
    const moved2 = shiftLayerMarkup(moved, 'layer-ink', 5, 5);
    expect(moved2).toContain('transform="translate(15 0)"');
  });

  it('throws on unknown layer (no silent no-op)', () => {
    const { svg } = scriptToSvg(script);
    expect(() => shiftLayerMarkup(svg, 'layer-nope', 1, 1)).toThrow(/nope/);
  });
});
