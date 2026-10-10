'use client';
import { useState } from 'react';
import { EntityGenerator } from '@/components/EntityGenerator';
import { EntityLibrary } from '@/components/EntityLibrary';
import { EntityPreview } from '@/components/EntityPreview';
import { KatanaGallery } from '@/components/KatanaGallery';
import { saveEntity } from '@/lib/entities';
import { remixReferencePiece } from '@/lib/remix';
import type { KatanaPiece } from '@/lib/katana-reference';
import type { DrawingScript } from '@/lib/drawing-script-schema';

export default function ItemsPage() {
  const [nonce, setNonce] = useState(0);
  const [preview, setPreview] = useState<DrawingScript | null>(null);
  const [remixBusy, setRemixBusy] = useState(false);
  const [remixStatus, setRemixStatus] = useState('');

  async function handleRemix(piece: KatanaPiece, extraPrompt: string) {
    if (!extraPrompt.trim()) {
      setRemixStatus('Опиши изменение выше — что сделать с эталоном.');
      return;
    }
    setRemixBusy(true);
    setRemixStatus('Подставляю эталон в Gemma vision…');
    try {
      const svgText = await (await fetch(piece.file)).text();
      const { script } = await remixReferencePiece({ svgText, name: piece.id, extraPrompt: extraPrompt.trim() });
      const saved = await saveEntity({ kind: 'item', name: `Ремикс ${piece.id}`, script });
      setNonce((n) => n + 1);
      setPreview(script);
      setRemixStatus(`Готово: ${saved.name} нарисован с эталона.`);
    } catch (e) {
      setRemixStatus(`Ошибка ремикса: ${(e as Error).message}`);
    } finally {
      setRemixBusy(false);
    }
  }

  return (
    <main>
      <h1 className="page-title">Предметы</h1>
      <EntityGenerator
        kind="item"
        title="Новый предмет"
        onSaved={(s) => {
          setNonce((n) => n + 1);
          setPreview(s);
        }}
      />
      <EntityPreview script={preview} />
      <KatanaGallery onRemix={handleRemix} busy={remixBusy} />
      <p className="status">{remixStatus}</p>
      <h2>Библиотека</h2>
      <div className="card">
        <EntityLibrary key={nonce} kind="item" />
      </div>
    </main>
  );
}
