import { describe, it, expect } from 'vitest';
import {
  resolveCast,
  composeScenePrompt,
  enqueuePaused,
  listQueue,
  editQueuedPrompt,
  resumeQueuedPrompt,
  removeQueued,
} from '@/lib/scene-composer';
import { saveEntity } from '@/lib/entities';
import type { DrawingScript } from '@/lib/drawing-script-schema';

const script = {
  style: { palette: ['#9b5de5', '#14121f'], linePencil: '#666', lineInk: '#111' },
  layers: ['a'],
  steps: [{ id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 L10 10' }] }],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'x', dirtyLayers: [] },
} as unknown as DrawingScript;

const lib = {
  characters: new Set(['Ая', 'Рин']),
  items: new Set(['Меч света']),
  locations: new Set(['Храм']),
};

describe('resolveCast', () => {
  it('reports no missing when everyone is drawn', () => {
    expect(
      resolveCast({ prompt: 'бой', characters: ['Ая'], items: ['Меч света'], location: 'Храм' }, lib),
    ).toEqual({ characters: [], items: [], location: null });
  });

  it('lists missing actors/items/location as draw proposals', () => {
    expect(
      resolveCast(
        { prompt: 'бой', characters: ['Ая', 'Кей'], items: ['Щит'], location: 'Мост' },
        lib,
      ),
    ).toEqual({ characters: ['Кей'], items: ['Щит'], location: 'Мост' });
  });

  it('empty cast is valid (pure location scene)', () => {
    expect(resolveCast({ prompt: 'тишина', characters: [], items: [], location: null }, lib).characters).toEqual([]);
  });
});

describe('composeScenePrompt', () => {
  it('embeds cast looks (palette) so Gemma keeps faces consistent', async () => {
    const aya = await saveEntity({ kind: 'character', name: 'Ая-К', script });
    const sword = await saveEntity({ kind: 'item', name: 'Меч-К', script });
    const p = composeScenePrompt(
      { prompt: 'Ая держит меч', characters: ['Ая-К'], items: ['Меч-К'], location: null },
      { characters: [aya], items: [sword] },
    );
    expect(p).toContain('Ая держит меч');
    expect(p).toContain('Ая-К');
    expect(p).toContain('#9b5de5');
  });
});

describe('paused prompt queue (never lose the prompt)', () => {
  it('enqueues paused prompt, edits it, resumes when cast complete', async () => {
    const q = await enqueuePaused({ prompt: 'финал', characters: ['Нова'], items: [], location: null });
    expect(q.status).toBe('paused');
    expect((await listQueue()).map((e) => e.id)).toContain(q.id);

    const edited = await editQueuedPrompt(q.id, { prompt: 'финал — ночь' });
    expect(edited.prompt).toBe('финал — ночь');

    // still missing Нова
    const still = await resumeQueuedPrompt(q.id, lib);
    if (still.status !== 'still-missing') throw new Error('expected still-missing');
    expect(still.missing.characters).toEqual(['Нова']);
    expect((await listQueue()).find((e) => e.id === q.id)?.status).toBe('paused');

    // draw Нова -> resume succeeds, prompt preserved through the pause
    await saveEntity({ kind: 'character', name: 'Нова', script });
    const lib2 = { ...lib, characters: new Set([...lib.characters, 'Нова']) };
    const ready = await resumeQueuedPrompt(q.id, lib2);
    expect(ready.status).toBe('ready');
    if (ready.status === 'ready') expect(ready.request.prompt).toBe('финал — ночь');
  });

  it('editing missing queue entry throws (no silent edit)', async () => {
    await expect(editQueuedPrompt('queue-nope', { prompt: 'x' })).rejects.toThrow();
  });

  it('removed entries disappear', async () => {
    const q = await enqueuePaused({ prompt: 'tmp', characters: [], items: [], location: null });
    await removeQueued(q.id);
    expect((await listQueue()).find((e) => e.id === q.id)).toBeUndefined();
  });
});
