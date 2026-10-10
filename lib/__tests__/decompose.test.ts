import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestElementList } from '@/lib/ollama-server';

function chatWith(content: string) {
  return { ok: true, json: async () => ({ message: { content } }) };
}

describe('requestElementList (decompose into drawable elements)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns element specs for a sword (handle, blade, engraving separately)', async () => {
    const list = {
      elements: [
        { name: 'Рукоять', kind: 'item', prompt: 'Sword handle: grip with diamond wrap, round pommel, straight guard' },
        { name: 'Клинок', kind: 'item', prompt: 'Sword blade: long straight double-edged blade' },
        { name: 'Гравировка', kind: 'item', prompt: 'Blade engraving: hieroglyph row along the fuller' },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(async () => chatWith(JSON.stringify(list))) as never);
    const out = await requestElementList({ kind: 'item', prompt: 'катана' });
    expect(out.elements.map((e) => e.name)).toEqual(['Рукоять', 'Клинок', 'Гравировка']);
  });

  it('rejects garbage and retries, then throws bounded (no fake decomposition)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => chatWith('{"nope":[]}')) as never);
    const err = (await requestElementList({ kind: 'scene', prompt: 'x' }).catch((e: unknown) => e)) as Error;
    expect(err.message).toMatch(/attempt|попыт/i);
  });

  it('throws on empty prompt without calling fetch', async () => {
    const f = vi.fn(async () => ({}) as never);
    vi.stubGlobal('fetch', f as never);
    await expect(requestElementList({ kind: 'scene', prompt: '  ' })).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
});
