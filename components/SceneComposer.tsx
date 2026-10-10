'use client';
import { useEffect, useState } from 'react';
import { DrawingScriptSchema, type DrawingScript } from '@/lib/drawing-script-schema';
import { EntityPreview } from '@/components/EntityPreview';
import {
  listEntities,
  findEntityByName,
  saveEntity,
  forkScene,
  type Entity,
} from '@/lib/entities';
import { validateSceneLayers } from '@/lib/lesson-pipeline';
import { auditCraft } from '@/lib/svg-craft';
import { templatesFor, getTemplate } from '@/lib/prompt-templates';
import {
  resolveCast,
  isComplete,
  composeScenePrompt,
  enqueuePaused,
  listQueue,
  editQueuedPrompt,
  resumeQueuedPrompt,
  removeQueued,
  type MissingReport,
  type QueuedPrompt,
  type SceneRequest,
} from '@/lib/scene-composer';

function parseList(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Scene studio: cast from library, missing-draw proposals, paused queue, forks. */
export function SceneComposer() {
  const [prompt, setPrompt] = useState('');
  const [charactersInput, setCharactersInput] = useState('');
  const [itemsInput, setItemsInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [missing, setMissing] = useState<MissingReport | null>(null);
  const [queue, setQueue] = useState<QueuedPrompt[]>([]);
  const [scenes, setScenes] = useState<Entity[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [pendingParent, setPendingParent] = useState<{ id: string; name: string } | null>(null);
  const [preview, setPreview] = useState<DrawingScript | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setQueue(await listQueue());
    setScenes(await listEntities('scene'));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function libraryIndex() {
    const [characters, items, locations] = await Promise.all([
      listEntities('character'),
      listEntities('item'),
      listEntities('location'),
    ]);
    return {
      characters: new Set(characters.map((e) => e.name)),
      items: new Set(items.map((e) => e.name)),
      locations: new Set(locations.map((e) => e.name)),
    };
  }

  async function generateScene(req: SceneRequest, queueId?: string, parentId?: string) {
    const [characters, items, locations] = await Promise.all([
      Promise.all(req.characters.map((n) => findEntityByName('character', n))),
      Promise.all(req.items.map((n) => findEntityByName('item', n))),
      req.location ? findEntityByName('location', req.location) : Promise.resolve(undefined),
    ]);
    const composed = composeScenePrompt(
      req,
      {
        characters: characters.filter(Boolean) as Entity[],
        items: items.filter(Boolean) as Entity[],
        location: locations ?? null,
      },
    );
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'scene', prompt: composed }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'scene generation failed');
    const script = DrawingScriptSchema.parse(data);
    const missingLayers = validateSceneLayers(script, req.characters);
    if (missingLayers.length > 0) {
      throw new Error(`актёры без слоёв в сцене (урок нарушен): ${missingLayers.join(', ')}`);
    }
    const locationEntity = req.location ? await findEntityByName('location', req.location) : undefined;
    const scene = await saveEntity({
      kind: 'scene',
      name: req.prompt.slice(0, 60) || 'Без названия',
      script,
      parentId: parentId ?? null,
      locationId: locationEntity?.id ?? null,
      cast: { characters: req.characters, items: req.items },
    });
    if (queueId) await removeQueued(queueId);
    return scene;
  }

  async function onCompose() {
    if (!prompt.trim()) {
      setStatus('Нужен промпт сцены.');
      return;
    }
    setBusy(true);
    try {
      const req: SceneRequest = {
        prompt: prompt.trim(),
        characters: parseList(charactersInput),
        items: parseList(itemsInput),
        location: locationInput.trim() || null,
      };
      const report = resolveCast(req, await libraryIndex());
      if (!isComplete(report)) {
        await enqueuePaused(req);
        setMissing(report);
        setStatus('Не все нарисованы — промпт сохранён в очередь на паузе.');
        await refresh();
        return;
      }
      setMissing(null);
      setStatus('Все на месте. Gemma собирает сцену…');
      const scene = await generateScene(req, undefined, pendingParent?.id);
      setPendingParent(null);
      setPreview(scene.script);
      setStatus(`Сцена готова: ${scene.name}. Качество линий: ${auditCraft(scene.script).score}/100.`);
      await refresh();
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onResume(id: string) {
    setBusy(true);
    try {
      const result = await resumeQueuedPrompt(id, await libraryIndex());
      if (result.status === 'ready') {
        setMissing(null);
        setStatus('Состав полный. Gemma собирает сцену…');
        const scene = await generateScene(result.request, id);
        setPreview(scene.script);
        setStatus(`Сцена готова: ${scene.name}. Качество линий: ${auditCraft(scene.script).score}/100.`);
      } else {
        setMissing(result.missing);
        setStatus('Всё ещё не хватает — дорисуй и нажми «Продолжить».');
      }
      await refresh();
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(id: string) {
    await editQueuedPrompt(id, { prompt: editText });
    setEditingId(null);
    await refresh();
  }

  async function onFork(id: string, name: string) {
    const fork = await forkScene(id, { name: `${name} (форк)` });
    setStatus(`Форк сохранён: ${fork.name} (parent: ${fork.parentId}).`);
    await refresh();
  }

  return (
    <section aria-label="Композитор сцен" className="card">
      <h2>Новая сцена</h2>
      <label>
        Шаблон сцены
        <select
          aria-label="Шаблон сцены"
          defaultValue=""
          onChange={(e) => {
            const t = getTemplate(e.target.value);
            if (t) setPrompt(t.prompt);
          }}
        >
          <option value="">Свой промпт…</option>
          {templatesFor('scene').map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Промпт сцены
        <textarea aria-label="Промпт сцены" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>
      <label>
        Персонажи (через запятую, из библиотеки)
        <input aria-label="Персонажи" value={charactersInput} onChange={(e) => setCharactersInput(e.target.value)} />
      </label>
      <label>
        Предметы (через запятую, из библиотеки)
        <input aria-label="Предметы" value={itemsInput} onChange={(e) => setItemsInput(e.target.value)} />
      </label>
      <label>
        Место (из библиотеки)
        <input aria-label="Место" value={locationInput} onChange={(e) => setLocationInput(e.target.value)} />
      </label>
      {pendingParent && <p>Новая версия сцены «{pendingParent.name}» (parent сохранится).</p>}
      <button type="button" className="btn-primary" onClick={onCompose} disabled={busy}>
        Собрать сцену
      </button>
      <p className="status">{status}</p>
      <EntityPreview script={preview} />

      {missing && (missing.characters.length > 0 || missing.items.length > 0 || missing.location) && (
        <div data-testid="missing-dialog" role="dialog" aria-label="Нужно дорисовать" className="dialog">
          <h3>Нужно дорисовать</h3>
          {missing.characters.length > 0 && (
            <p>
              Персонажи: {missing.characters.join(', ')} — нарисуй на вкладке «Персонажи».
            </p>
          )}
          {missing.items.length > 0 && (
            <p>
              Предметы: {missing.items.join(', ')} — нарисуй на вкладке «Предметы».
            </p>
          )}
          {missing.location && <p>Место: {missing.location} — нарисуй на вкладке «Места».</p>}
        </div>
      )}

      {queue.length > 0 && (
        <div className="card">
          <h3>Очередь (на паузе)</h3>
          <ul className="list">
            {queue.map((q) => (
              <li key={q.id}>
                <span>
                  {q.prompt} — {q.status === 'paused' ? 'на паузе' : 'готова'}
                </span>{' '}
                <button type="button" onClick={() => { setEditingId(q.id); setEditText(q.prompt); }}>
                  Редактировать
                </button>{' '}
                <button type="button" onClick={() => onResume(q.id)} disabled={busy}>
                  Продолжить
                </button>
                {editingId === q.id && (
                  <div>
                    <textarea aria-label="Редактировать промпт" value={editText} onChange={(e) => setEditText(e.target.value)} />
                    <button type="button" onClick={() => onSaveEdit(q.id)}>
                      Сохранить
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {scenes.length > 0 && (
        <div className="card">
          <h3>Сцены</h3>
          <ul className="list">
            {scenes.map((s) => (
              <li key={s.id}>
                <span>
                  {s.name} ({s.id}
                  {s.parentId ? `, parent: ${s.parentId}` : ''})
                </span>{' '}
                <button type="button" onClick={() => onFork(s.id, s.name)}>
                  Форк
                </button>{' '}
                <button
                  type="button"
                  onClick={() => {
                    setPrompt(`Новая версия: ${s.name}`);
                    setCharactersInput((s.cast?.characters ?? []).join(', '));
                    setItemsInput((s.cast?.items ?? []).join(', '));
                    setPendingParent({ id: s.id, name: s.name });
                  }}
                >
                  Новая версия
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
