import { describe, it, expect } from 'vitest';
import {
  saveEntity,
  getEntity,
  listEntities,
  findEntityByName,
  deleteEntity,
  forkScene,
} from '@/lib/entities';
import type { DrawingScript } from '@/lib/drawing-script-schema';

const script = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['a'],
  steps: [{ id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 L10 10' }] }],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'x', dirtyLayers: [] },
} as unknown as DrawingScript;

describe('entities library', () => {
  it('saves and gets a character by id', async () => {
    const e = await saveEntity({ kind: 'character', name: 'Ая', script });
    expect(e.id).toContain('character');
    expect(await getEntity(e.id)).toMatchObject({ kind: 'character', name: 'Ая' });
  });

  it('lists only requested kind', async () => {
    await saveEntity({ kind: 'item', name: 'Меч света', script });
    await saveEntity({ kind: 'location', name: 'Храм', script });
    const items = await listEntities('item');
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.every((i) => i.kind === 'item')).toBe(true);
    expect(items.map((i) => i.name)).toContain('Меч света');
  });

  it('finds entity by name within kind (no cross-kind fake)', async () => {
    await saveEntity({ kind: 'character', name: 'Рин', script });
    expect(await findEntityByName('character', 'Рин')).toBeTruthy();
    expect(await findEntityByName('item', 'Рин')).toBeUndefined();
  });

  it('returns undefined for missing id', async () => {
    expect(await getEntity('character-missing-xyz')).toBeUndefined();
  });

  it('deletes entity', async () => {
    const e = await saveEntity({ kind: 'item', name: 'Временный', script });
    await deleteEntity(e.id);
    expect(await getEntity(e.id)).toBeUndefined();
  });

  it('forkScene links parent and keeps cast unless overridden', async () => {
    const loc = await saveEntity({ kind: 'location', name: 'Поляна', script });
    const hero = await saveEntity({ kind: 'character', name: 'Герой', script });
    const s1 = await saveEntity({
      kind: 'scene',
      name: 'Встреча',
      script,
      locationId: loc.id,
      cast: { characters: [hero.name], items: [] },
    });
    const s2 = await forkScene(s1.id, { name: 'Встреча — ночь' });
    expect(s2.parentId).toBe(s1.id);
    expect(s2.name).toBe('Встреча — ночь');
    expect(s2.cast).toEqual({ characters: ['Герой'], items: [] });
    expect(s2.locationId).toBe(loc.id);
  });

  it('forkScene of missing scene throws (no silent copy)', async () => {
    await expect(forkScene('scene-nope', { name: 'x' })).rejects.toThrow();
  });
});
