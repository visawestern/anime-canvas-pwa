'use client';
import { useEffect, useState } from 'react';
import { listEntities, deleteEntity, type Entity, type EntityKind } from '@/lib/entities';

/** Offline library list for one kind, with honest delete. */
export function EntityLibrary({ kind, onChange }: { kind: EntityKind; onChange?: () => void }) {
  const [items, setItems] = useState<Entity[]>([]);

  async function refresh() {
    setItems(await listEntities(kind));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  async function onDelete(id: string) {
    await deleteEntity(id);
    await refresh();
    onChange?.();
  }

  if (items.length === 0) return <p className="status">Пока пусто — нарисуй первого выше.</p>;
  return (
    <ul className="list">
      {items.map((e) => (
        <li key={e.id}>
          <span>
            {e.name} <span className="badge">{e.script.steps.length} шагов</span>
          </span>{' '}
          <button type="button" className="btn-danger" onClick={() => onDelete(e.id)}>
            Удалить
          </button>
        </li>
      ))}
    </ul>
  );
}
