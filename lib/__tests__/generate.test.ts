import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildTextRequest } from '@/lib/ollama';
import { KIND_PROMPTS, buildKindPrompt, type GenerateKind } from '@/lib/generate-prompts';
import { requestDrawingScriptFromPrompt } from '@/lib/ollama-server';

describe('buildTextRequest (prompt-only, no photo)', () => {
  it('builds json chat request without images', () => {
    const req = buildTextRequest({ prompt: 'нарисуй героя', model: 'gemma4:31b-cloud' });
    expect(req.model).toBe('gemma4:31b-cloud');
    expect(req.format).toBe('json');
    expect(req.messages[0].images).toBeUndefined();
    expect(req.messages[0].content).toContain('нарисуй героя');
  });

  it('throws on empty prompt (no fake generation)', () => {
    expect(() => buildTextRequest({ prompt: '  ', model: 'gemma4:31b-cloud' })).toThrow();
  });
});

describe('KIND_PROMPTS', () => {
  it('covers character/item/location/scene with DrawingScript rules', () => {
    const kinds: GenerateKind[] = ['character', 'item', 'location', 'scene'];
    for (const k of kinds) {
      expect(KIND_PROMPTS[k]).toContain('DrawingScript');
      expect(KIND_PROMPTS[k]).toContain('JSON');
      expect(KIND_PROMPTS[k]).toContain('LESSON CANON');
      expect(KIND_PROMPTS[k]).toContain('B6');
    }
    expect(KIND_PROMPTS.character).toMatch(/eyes|hair|hands/i);
    expect(KIND_PROMPTS.scene).toMatch(/backdrop|actor|cast/i);
  });

  it('buildKindPrompt injects user prompt into kind template', () => {
    const p = buildKindPrompt('item', 'светящийся меч');
    expect(p).toContain('светящийся меч');
    expect(p).toContain(KIND_PROMPTS.item.slice(0, 20));
  });
});

describe('requestDrawingScriptFromPrompt', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns validated script for text prompt', async () => {
    const script = {
      style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
      layers: ['a'],
      steps: [{ id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 L5 5' }] }],
      rig: { bones: [], morphTargets: [] },
      anim: { fps: 12, loop: 'x', dirtyLayers: [] },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: JSON.stringify(script) } }) })) as never,
    );
    const out = await requestDrawingScriptFromPrompt({ kind: 'character', prompt: 'герой с мечом' });
    expect(out.steps).toHaveLength(1);
  });

  it('throws on empty prompt without calling fetch', async () => {
    const f = vi.fn(async () => ({}) as never);
    vi.stubGlobal('fetch', f as never);
    await expect(requestDrawingScriptFromPrompt({ kind: 'item', prompt: '' })).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
});
