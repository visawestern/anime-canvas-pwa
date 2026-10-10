'use client';
import { useEffect, useState } from 'react';
import { listEntities, saveEntity, type Entity } from '@/lib/entities';
import { DrawingScriptSchema } from '@/lib/drawing-script-schema';
import { EntityThumb } from '@/components/EntityThumb';

const NOUN = { character: 'персонажа', item: 'предмета' } as const;
const TITLE = { character: 'Персонажи', item: 'Предметы' } as const;

export interface CastPickerProps {
  kind: 'character' | 'item';
  selected: string[];
  onChange: (names: string[]) => void;
}

/** Professional cast multi-select: checkboxes over library avatars + inline quick-add. */
export function CastPicker({ kind, selected, onChange }: CastPickerProps) {
  const [items, setItems] = useState<Entity[]>([]);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setItems(await listEntities(kind));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function toggle(n: string) {
    onChange(selected.includes(n) ? selected.filter((x) => x !== n) : [...selected, n]);
  }

  async function quickAdd() {
    if (!name.trim() || !prompt.trim()) {
      setStatus('Укажи имя и промпт.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'generation failed');
      const script = DrawingScriptSchema.parse(data);
      const saved = await saveEntity({ kind, name: name.trim(), script });
      setName('');
      setPrompt('');
      setStatus(`Нарисован и выбран: ${saved.name}.`);
      await refresh();
      if (!selected.includes(saved.name)) onChange([...selected, saved.name]);
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" aria-label={`Выбор: ${TITLE[kind]}`}>
      <h3>
        {TITLE[kind]} {selected.length > 0 && <span className="badge">выбрано: {selected.length}</span>}
      </h3>
      {items.length === 0 ? (
        <p className="status">Пока пусто — создай первого ниже.</p>
      ) : (
        <ul className="list">
          {items.map((e) => (
            <li key={e.id}>
              <EntityThumb script={e.script} size={56} />
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(e.name)}
                  onChange={() => toggle(e.name)}
                />{' '}
                {e.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div>
        <label>
          Имя {NOUN[kind]}
          <input aria-label={`Имя ${NOUN[kind]}`} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Промпт {NOUN[kind]}
          <textarea aria-label={`Промпт ${NOUN[kind]}`} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </label>
        <div className="btn-row">
          <button type="button" className="btn-primary" onClick={quickAdd} disabled={busy}>
            Нарисовать {NOUN[kind]}
          </button>
        </div>
        <p className="status">{status}</p>
      </div>
    </div>
  );
}
