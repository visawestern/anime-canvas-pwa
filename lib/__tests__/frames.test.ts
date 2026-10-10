import { describe, it, expect } from 'vitest';
import { saveFrame, loadFrameSvg, listFrames } from '@/lib/frames';

const svg1 = '<svg viewBox="0 0 512 512"><g id="layer-a"><g id="part-a-x" data-part="x"><path id="p1" d="M0 0 L10 10"/></g><g id="part-a-y" data-part="y"><path id="p2" d="M0 0 L20 20"/></g></g></svg>';
const svg2 = '<svg viewBox="0 0 512 512"><g id="layer-a"><g id="part-a-x" data-part="x"><path id="p1" d="M0 0 L10 10"/></g><g id="part-a-y" data-part="y"><path id="p2" d="M0 0 L30 30"/></g></g></svg>';

describe('frames (full base + diff patches)', () => {
  it('first frame saves full markup', async () => {
    const f = await saveFrame(svg1, null);
    expect(f.prevId).toBeNull();
    expect(f.full).toBe(svg1);
    expect(f.changed).toEqual([]);
    expect(f.bytes).toBeGreaterThan(svg1.length);
  });

  it('next frame stores only changed part blocks', async () => {
    const base = await saveFrame(svg1, null);
    const next = await saveFrame(svg2, base.id);
    expect(next.full).toBeNull();
    expect(next.changed).toEqual(['part-a-y']);
    expect(Object.keys(next.patches)).toEqual(['part-a-y']);
    expect(JSON.stringify(next.patches).length).toBeLessThan(svg2.length);
  });

  it('resolves chains back to full svg', async () => {
    const b = await saveFrame(svg1, null);
    const n = await saveFrame(svg2, b.id);
    expect(await loadFrameSvg(n.id)).toBe(svg2);
    expect(await loadFrameSvg(b.id)).toBe(svg1);
  });

  it('records empty diff honestly when nothing changed', async () => {
    const b = await saveFrame(svg1, null);
    const same = await saveFrame(svg1, b.id);
    expect(same.changed).toEqual([]);
    expect(same.patches).toEqual({});
    expect(await loadFrameSvg(same.id)).toBe(svg1);
  });

  it('tombstones removed parts', async () => {
    const b = await saveFrame(svg1, null);
    const cut = '<svg viewBox="0 0 512 512"><g id="layer-a"><g id="part-a-x" data-part="x"><path id="p1" d="M0 0 L10 10"/></g></g></svg>';
    const n = await saveFrame(cut, b.id);
    expect(n.changed).toContain('part-a-y');
    expect(await loadFrameSvg(n.id)).toBe(cut);
  });

  it('throws on unknown base (no fake resolve)', async () => {
    await expect(saveFrame(svg1, 'fr-nope')).rejects.toThrow(/nope/);
    await expect(loadFrameSvg('fr-nope')).rejects.toThrow(/nope/);
  });

  it('lists frames newest last', async () => {
    const before = (await listFrames()).length;
    await saveFrame(svg1, null);
    expect((await listFrames()).length).toBe(before + 1);
  });
});
