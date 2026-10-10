import { describe, it, expect } from 'vitest';
import { SVG_CRAFT_RULES, svgCraftBlock, lineArtBlock, auditCraft } from '@/lib/svg-craft';
import { KIND_PROMPTS } from '@/lib/generate-prompts';
import { ANIME_DIRECTOR_PROMPT } from '@/lib/anime-director-prompt';
import type { DrawingScript } from '@/lib/drawing-script-schema';
import type { CraftAudit } from '@/lib/svg-craft';

const txt = (a: CraftAudit) => a.findings.map((f) => `${f.rule} ${f.detail}`).join(' ');

function scriptWith(opts: {
  strokes?: { path: string; w?: number; o?: number }[];
  fills?: { path: string; color: string }[];
}): DrawingScript {
  const colors = [...new Set((opts.fills ?? []).map((f) => f.color))];
  return {
    style: { palette: colors.length > 0 ? colors : ['#fff'], linePencil: '#666', lineInk: '#111' },
    layers: ['a', 'ink', 'fill'],
    steps: [
      { id: 1, kind: 'pencil', layer: 'a', strokes: opts.strokes ?? [{ path: 'M0 0 L100 100', w: 1.2, o: 0.5 }] },
      { id: 2, kind: 'ink', layer: 'ink', strokes: [{ path: 'M0 0 L100 100', w: 2.4, o: 1 }] },
      ...(opts.fills
        ? [{ id: 3, kind: 'fill' as const, layer: 'fill', fills: opts.fills }]
        : []),
    ],
    rig: { bones: [], morphTargets: [] },
    anim: { fps: 12, loop: 'x', dirtyLayers: [] },
  } as unknown as DrawingScript;
}

describe('svgCraftBlock (distilled logo-craft)', () => {
  it('distills construction, angles, anchors, micro-details, overshoot', () => {
    expect(SVG_CRAFT_RULES.length).toBeGreaterThanOrEqual(6);
    const b = svgCraftBlock();
    expect(b).toContain('SVG CRAFT');
    expect(b).toMatch(/exact.*angles|точные углы/i);
    expect(b).toMatch(/overshoot/i);
    expect(b).toMatch(/512/);
  });

  it('encourages short coordinate strings (integers preferred)', () => {
    expect(svgCraftBlock()).toMatch(/short coordinate|integers preferred/i);
  });
});

describe('lineArtBlock (Anime_Girl reference + Surbhi write-on)', () => {
  it('demands strokes-only art, one <g> per part sequenced like Surbhi ids', () => {
    const b = lineArtBlock();
    expect(b).toContain('LINE ART');
    expect(b).toMatch(/no fill/i);
    expect(b).toMatch(/<g>|Surbhi/i);
  });

  it('is wired into every generation prompt', () => {
    for (const k of ['character', 'item', 'location', 'scene'] as const) {
      expect(KIND_PROMPTS[k]).toContain('LINE ART');
    }
    expect(ANIME_DIRECTOR_PROMPT).toContain('LINE ART');
  });

  it('flags flat fills as a line-art signal (score, not gate)', () => {
    const a = auditCraft(scriptWith({ fills: [{ path: 'M0 0 L100 0 L100 100 Z', color: '#fff' }] }));
    expect(txt(a)).toMatch(/line-art|hatch/i);
    expect(a.score).toBeLessThan(100);
  });

  it('is wired into every generation prompt', () => {
    for (const k of ['character', 'item', 'location', 'scene'] as const) {
      expect(KIND_PROMPTS[k]).toContain('SVG CRAFT');
    }
    expect(ANIME_DIRECTOR_PROMPT).toContain('SVG CRAFT');
  });
});

describe('auditCraft (svg_audit.py adapted to DrawingScript)', () => {
  it('scores a clean strokes-only script 100 with no findings', () => {
    const a = auditCraft(scriptWith({}));
    expect(a.score).toBe(100);
    expect(a.findings).toEqual([]);
  });

  it('flags anchor-heavy paths (lumpy-curve risk)', () => {
    const a = auditCraft(scriptWith({ strokes: [{ path: 'M0 0 ' + 'L1 1 '.repeat(60), w: 1.2, o: 0.5 }] }));
    expect(txt(a)).toMatch(/anchor/i);
    expect(a.score).toBeLessThan(100);
  });

  it('flags micro-details below 1/64 of the 512 canvas', () => {
    const a = auditCraft(scriptWith({ fills: [{ path: 'M0 0 L5 0 L5 5 Z', color: '#fff' }] }));
    expect(txt(a)).toMatch(/tiny|micro/i);
  });

  it('flags undisciplined palettes (5+ fill colors)', () => {
    const a = auditCraft(
      scriptWith({
        fills: ['#a', '#b', '#c', '#d', '#e'].map((color, i) => ({
          path: `M${i * 20} 0 L${i * 20 + 10} 0 L${i * 20 + 10} 10 Z`,
          color,
        })),
      }),
    );
    expect(txt(a)).toMatch(/colou?r/i);
  });

  it('flags near-miss angles but accepts exact 45°', () => {
    const bad = auditCraft(scriptWith({ strokes: [{ path: 'M0 0 L100 3.5', w: 1.2, o: 0.5 }] }));
    expect(txt(bad)).toMatch(/angle/i);
    const good = auditCraft(scriptWith({ strokes: [{ path: 'M0 0 L100 100', w: 1.2, o: 0.5 }] }));
    expect(txt(good)).not.toMatch(/angle/i);
  });

  it('flags unclosed fills and survives unparseable paths without throwing', () => {
    const a = auditCraft(
      scriptWith({
        strokes: [{ path: 'M0 0 X1 1', w: 1.2, o: 0.5 }],
        fills: [{ path: 'M0 0 L100 0 L100 100', color: '#fff' }],
      }),
    );
    const text = txt(a);
    expect(text).toMatch(/close/i);
    expect(text).toMatch(/parse|unparseable/i);
  });

  it('imposes no step/stroke limits (long films are welcome)', () => {
    const many = {
      style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
      layers: ['a'],
      steps: Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        kind: 'pencil',
        layer: 'a',
        strokes: [{ path: 'M0 0 L1 1', w: 1.2, o: 0.5 }],
      })),
      rig: { bones: [], morphTargets: [] },
      anim: { fps: 12, loop: 'x', dirtyLayers: [] },
    } as unknown as DrawingScript;
    expect(txt(auditCraft(many))).not.toMatch(/bloat|compact/i);
  });

  it('flags over-precise coordinates (LLM4SVG note: integers preferred, max 2 decimals)', () => {
    const a = auditCraft(scriptWith({ strokes: [{ path: 'M0.123 0.456 L10 10', w: 1.2, o: 0.5 }] }));
    expect(txt(a)).toMatch(/precision|decimal/i);
    const clean = auditCraft(scriptWith({ strokes: [{ path: 'M0.12 0.45 L10 10', w: 1.2, o: 0.5 }] }));
    expect(txt(clean)).not.toMatch(/precision|decimal/i);
  });
});
