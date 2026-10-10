'use client';
import { useEffect, useState } from 'react';
import { listEntities, deleteEntity, type Entity, type EntityKind } from '@/lib/entities';
import { EntityThumb } from '@/components/EntityThumb';
import { EntityPreview } from '@/components/EntityPreview';

/** Offline library list (Vuexy-style rows with avatars); click opens the saved art. */
export function EntityLibrary({ kind, onChange }: { kind: EntityKind; onChange?: () => void }) {
  const [items, setItems] = useState<Entity[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  async function refresh() {
    setItems(await listEntities(kind));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  async function onDelete(id: string) {
    await deleteEntity(id);
    if (openId === id) setOpenId(null);
    await refresh();
    onChange?.();
  }

  const opened = items.find((e) => e.id === openId) ?? null;

  if (items.length === 0) return <p className="status">Пока пусто — нарисуй первого выше.</p>;
  return (
    <>
      <ul className="list">
        {items.map((e) => (
          <li key={e.id}>
            <EntityThumb script={e.script} size={72} />
            <span>
              {e.name} <span className="badge">{e.script.steps.length} шагов</span>
            </span>{' '}
            <button type="button" className="btn-primary" onClick={() => setOpenId(e.id)}>
              Открыть
            </button>{' '}
            <button type="button" className="btn-danger" onClick={() => onDelete(e.id)}>
              Удалить
            </button>
          </li>
        ))}
      </ul>
      {opened && (
        <div role="dialog" aria-label={`Просмотр: ${opened.name}`} className="dialog">
          <h3>
            {opened.name} <span className="badge">{opened.script.steps.length} шагов</span>
          </h3>
          <EntityPreview script={opened.script} />
          <div className="btn-row">
            <button type="button" onClick={() => setOpenId(null)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </>
  );
}
