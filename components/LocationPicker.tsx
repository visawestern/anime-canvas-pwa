'use client';
import { useEffect, useState } from 'react';
import { listEntities, saveEntity, type Entity } from '@/lib/entities';
import { DrawingScriptSchema } from '@/lib/drawing-script-schema';
import { EntityThumb } from '@/components/EntityThumb';

export interface LocationPickerProps {
  selected: string | null;
  onChange: (name: string | null) => void;
}

/** Single-select location picker with inline quick-add. */
export function LocationPicker({ selected, onChange }: LocationPickerProps) {
  const [items, setItems] = useState<Entity[]>([]);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setItems(await listEntities('location'));
  }

  useEffect(() => {
    refresh();
  }, []);

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
        body: JSON.stringify({ kind: 'location', prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'generation failed');
      const script = DrawingScriptSchema.parse(data);
      const saved = await saveEntity({ kind: 'location', name: name.trim(), script });
      setName('');
      setPrompt('');
      setStatus(`Нарисовано и выбрано: ${saved.name}.`);
      await refresh();
      onChange(saved.name);
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" aria-label="Выбор: место">
      <h3>Место</h3>
      {items.length === 0 ? (
        <p className="status">Пока пусто — создай первое ниже.</p>
      ) : (
        <ul className="list">
          {items.map((e) => (
            <li key={e.id}>
              <EntityThumb script={e.script} size={56} />
              <label>
                <input
                  type="radio"
                  name="scene-location"
                  checked={selected === e.name}
                  onChange={() => onChange(e.name)}
                />{' '}
                {e.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div>
        <label>
          Имя места
          <input aria-label="Имя места" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Промпт места
          <textarea aria-label="Промпт места" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </label>
        <div className="btn-row">
          <button type="button" className="btn-primary" onClick={quickAdd} disabled={busy}>
            Нарисовать место
          </button>
        </div>
        <p className="status">{status}</p>
      </div>
    </div>
  );
}
