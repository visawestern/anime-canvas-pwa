'use client';
import { useState } from 'react';
import { KATANA_PIECES, KATANA_SCENE, type KatanaPiece } from '@/lib/katana-reference';

export interface KatanaGalleryProps {
  onRemix: (piece: KatanaPiece, extraPrompt: string) => void;
  busy: boolean;
}

/** Decomposed katana pack (7 standalone pieces) + room scene example as remix bases. */
export function KatanaGallery({ onRemix, busy }: KatanaGalleryProps) {
  const [extra, setExtra] = useState('');

  return (
    <section aria-label="Эталоны катан" className="card">
      <h2>Эталоны: пачка катан</h2>
      <p className="status">Разобранный Katana-02: 7 клинков по отдельности. Опиши изменение — эталон подставится сам.</p>
      <label>
        Что изменить
        <textarea aria-label="Что изменить" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="красная оплётка рукояти, гравировка дракона на клинке" />
      </label>
      <ul className="list">
        {KATANA_PIECES.map((p) => (
          <li key={p.id}>
            <img src={p.file} alt={`Катана ${p.id}`} width={72} />
            <span>
              {p.id} <span className="badge">{p.paths} лин.</span>
            </span>{' '}
            <button type="button" onClick={() => onRemix(p, extra)} disabled={busy}>
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
