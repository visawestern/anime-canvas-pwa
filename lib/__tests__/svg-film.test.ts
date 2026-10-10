import { describe, it, expect } from 'vitest';
import { scriptToSvg, shiftLayerMarkup, shiftPartMarkup, highlightPartMarkup, verifyFilm, diffParts } from '@/lib/svg-film';
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
    // stroke outlines (non-fillin paths) all start before any color fades in
    const strokeDelays = [...svg.matchAll(/<path(?![^>]*class="fillin")[^>]*--dl:([\d.]+)s/g)].map((m) =>
      Number(m[1]),
    );
    const fillDelays = [...svg.matchAll(/--fl:([\d.]+)s/g)].map((m) => Number(m[1]));
    expect(strokeDelays.length).toBe(2);
    expect(Math.min(...fillDelays)).toBeGreaterThanOrEqual(Math.max(...strokeDelays));
    expect(total).toBeGreaterThan(Math.max(...fillDelays));
  });

  it('no fills entry when the script has no fills (pure line art)', () => {
    const noFills = { ...script, steps: script.steps.filter((s) => (s as { kind: string }).kind !== 'shade') };
    const film = scriptToSvg(noFills as unknown as DrawingScript);
    expect(film.schedule.some((s) => s.kind === 'fills')).toBe(false);
  });

  it('honors custom gap/dur options', () => {
    const film = scriptToSvg(script, { gap: 1, dur: 2 });
    expect(film.svg).toContain('--dl:1.00s');
  });

  it('defaults uncolored fills to gray instead of crashing', () => {
    const noColor = {
      ...script,
      steps: [{ id: 1, kind: 'fill', layer: 'a', fills: [{ path: 'M0 0 L10 0 L10 10 Z' }] }],
    } as unknown as DrawingScript;
    expect(scriptToSvg(noColor).svg).toContain('fill="#999999"');
  });

  it('grades set stroke width, ink draws dark like the reference pencil', () => {
    const { svg } = scriptToSvg(script);
    expect(svg).toContain('stroke-width="2.4"');
    expect(svg).toContain('stroke-width="1.2"');
  });

  it('uniform drawing speed: duration proportional to path length', () => {
    const lenScript = {
      ...script,
      steps: [
        { id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 L100 0', w: 1.2, o: 0.5 }] },
        { id: 2, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 L1000 0', w: 1.2, o: 0.5 }] },
      ],
    } as unknown as DrawingScript;
    const { svg } = scriptToSvg(lenScript);
    const durs = [...svg.matchAll(/--d:([\d.]+)s/g)].map((m) => Number(m[1]));
    expect(durs).toHaveLength(2);
    expect(durs[1] / durs[0]).toBeCloseTo(10, 0);
  });

  it('dots pop instantly (zero length draws in zero time, by design)', () => {
    const dotScript = {
      ...script,
      steps: [{ id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M5 5 L5 5', w: 1.2, o: 0.5 }] }],
    } as unknown as DrawingScript;
    const { svg } = scriptToSvg(dotScript);
    const durs = [...svg.matchAll(/--d:([\d.]+)s/g)].map((m) => Number(m[1]));
    expect(durs[0]).toBeCloseTo(0, 2);
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

describe('parts (nested <g data-part>, z-ordered)', () => {
  const parted = {
    style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
    layers: ['a'],
    steps: [
      { id: 1, kind: 'pencil', layer: 'a', part: 'handle', strokes: [{ path: 'M0 0 L10 10', w: 1.2, o: 0.5 }] },
      { id: 2, kind: 'ink', layer: 'a', part: 'blade', strokes: [{ path: 'M0 0 L20 0', w: 2.4, o: 1 }] },
      { id: 3, kind: 'ink', layer: 'a', strokes: [{ path: 'M0 0 L5 5', w: 2.4, o: 1 }] },
    ],
    rig: { bones: [], morphTargets: [] },
    anim: { fps: 12, loop: 'x', dirtyLayers: [] },
  } as unknown as DrawingScript;

  it('nests one <g data-part> per part inside its layer (missing part falls back to layer)', () => {
    const { svg } = scriptToSvg(parted);
    expect(svg).toContain('<g id="part-a-handle" data-part="handle">');
    expect(svg).toContain('<g id="part-a-blade" data-part="blade">');
    expect(svg).toContain('<g id="part-a-a" data-part="a">');
  });

  it('exposes parts in z-order with counts (document order = paint order)', () => {
    const { parts } = scriptToSvg(parted);
    expect(parts.map((p) => p.part)).toEqual(['handle', 'blade', 'a']);
    expect(parts[0]).toMatchObject({ layer: 'a', paths: 1 });
  });

  it('shiftPartMarkup moves one part, others untouched; unknown part throws', () => {
    const { svg } = scriptToSvg(parted);
    const moved = shiftPartMarkup(svg, 'part-a-blade', 4, 4);
    expect(moved).toContain('<g id="part-a-blade" data-part="blade" transform="translate(4 4)">');
    expect(moved).not.toContain('part-a-handle" transform');
    expect(() => shiftPartMarkup(svg, 'part-a-nope', 1, 1)).toThrow(/nope/);
  });

  it('highlightPartMarkup paints every line of one part red, others untouched', () => {
    const { svg } = scriptToSvg(parted);
    const red = highlightPartMarkup(svg, 'part-a-blade');
    const blade = /<g id="part-a-blade"[^>]*>([\s\S]*?)<\/g>/.exec(red)![1];
    expect(blade.match(/stroke="#e11d48"/g)?.length).toBe(1);
    const handle = /<g id="part-a-handle"[^>]*>([\s\S]*?)<\/g>/.exec(red)![1];
    expect(handle).not.toContain('#e11d48');
    expect(() => highlightPartMarkup(svg, 'part-a-nope')).toThrow(/nope/);
  });
});

describe('diffParts (next frame saves only changed objects)', () => {
  const base = {
    style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
    layers: ['a'],
    steps: [
      { id: 1, kind: 'pencil', layer: 'a', part: 'handle', strokes: [{ path: 'M0 0 L10 10', w: 1.2, o: 0.5 }] },
      { id: 2, kind: 'ink', layer: 'a', part: 'blade', strokes: [{ path: 'M0 0 L20 0', w: 2.4, o: 1 }] },
    ],
    rig: { bones: [], morphTargets: [] },
    anim: { fps: 12, loop: 'x', dirtyLayers: [] },
  } as unknown as DrawingScript;

  it('lists only parts whose geometry changed (added/removed count too)', () => {
    const next = {
      ...base,
      steps: [
        base.steps[0],
        { id: 2, kind: 'ink', layer: 'a', part: 'blade', strokes: [{ path: 'M0 0 L30 0', w: 2.4, o: 1 }] },
        { id: 3, kind: 'ink', layer: 'a', part: 'engraving', strokes: [{ path: 'M1 1 L2 2', w: 1.4, o: 0.8 }] },
      ],
    } as unknown as DrawingScript;
    expect(diffParts(base, next)).toEqual(['blade', 'engraving']);
    expect(diffParts(base, base)).toEqual([]);
  });
});

describe('verifyFilm (re-check of the finished drawing)', () => {
  it('passes a healthy film with counts', () => {
    const { svg } = scriptToSvg(script);
    const v = verifyFilm(svg);
    expect(v.ok).toBe(true);
    expect(v.paths).toBe(3);
    expect(v.layers).toEqual(['layer-construction', 'layer-ink']);
    expect(v.issues).toEqual([]);
  });

  it('flags fully off-canvas art (drawn outside the frame)', () => {
    const { svg } = scriptToSvg({
      ...script,
      steps: [{ id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M900 900 L950 950', w: 1.2, o: 0.5 }] }],
    } as unknown as DrawingScript);
    const v = verifyFilm(svg);
    expect(v.ok).toBe(false);
    expect(v.issues.join(' ')).toMatch(/frame|кадр|outside/i);
  });

  it('catches every out-of-frame side (all bounds operands)', () => {
    const sides = {
      ...script,
      steps: [
        { id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M-100 10 L-90 20', w: 1.2, o: 0.5 }] },
        { id: 2, kind: 'pencil', layer: 'a', strokes: [{ path: 'M10 -100 L20 -90', w: 1.2, o: 0.5 }] },
        { id: 3, kind: 'pencil', layer: 'a', strokes: [{ path: 'M10 900 L20 950', w: 1.2, o: 0.5 }] },
      ],
    } as unknown as DrawingScript;
    const v = verifyFilm(scriptToSvg(sides).svg);
    expect(v.ok).toBe(false);
    expect(v.issues).toHaveLength(3);
  });

  it('ignores the internal fills marker as a layer', () => {
    const v = verifyFilm('<svg viewBox="0 0 512 512"><g id="__fills"><path id="p" d="M0 0 L10 10"/></g></svg>');
    expect(v.layers).not.toContain('__fills');
    expect(v.paths).toBe(1);
  });

  it('flags unparseable and degenerate paths without throwing', () => {
    const v = verifyFilm(
      '<svg viewBox="0 0 512 512"><g id="layer-a"><path id="p1" d="M0 0 X1 1"/><path id="p2" d="M5 5"/></g></svg>',
    );
    expect(v.ok).toBe(false);
    expect(v.issues.join(' ')).toMatch(/parse|unparseable/i);
    expect(v.issues.join(' ')).toMatch(/degenerate|точк/i);
  });

  it('empty film is not ok (nothing was drawn)', () => {
    const v = verifyFilm('<svg viewBox="0 0 512 512"></svg>');
    expect(v.ok).toBe(false);
    expect(v.paths).toBe(0);
  });
});
