'use client';
import { KATANA_PIECES, KATANA_SCENE, KATANA_BRIEF } from '@/lib/katana-reference';

export interface KatanaGalleryProps {
  onRemix: (prompt: string, name: string) => void;
}

/** Decomposed katana pack (7 standalone pieces) + room scene example as remix bases. */
export function KatanaGallery({ onRemix }: KatanaGalleryProps) {
  return (
    <section aria-label="Эталоны катан" className="card">
      <h2>Эталоны: пачка катан</h2>
      <p className="status">Разобранный Katana-02: 7 клинков по отдельности. Возьми любой за основу ремикса.</p>
      <ul className="list">
        {KATANA_PIECES.map((p) => (
          <li key={p.id}>
            <img src={p.file} alt={`Катана ${p.id}`} width={72} />
            <span>
              {p.id} <span className="badge">{p.paths} лин.</span>
            </span>{' '}
            <button
              type="button"
              onClick={() => onRemix(`${KATANA_BRIEF}\n\nРемикс ${p.id}: `, `Катана ${p.id}`)}
            >
              Взять за основу
            </button>
          </li>
        ))}
      </ul>
      <h3>Пример рисовки</h3>
      <img src={KATANA_SCENE.file} alt={KATANA_SCENE.caption} width={256} />
      <p className="status">{KATANA_SCENE.caption}</p>
    </section>
  );
}
