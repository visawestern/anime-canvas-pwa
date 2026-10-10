'use client';
import { useState } from 'react';
import { EntityGenerator } from '@/components/EntityGenerator';
import { EntityLibrary } from '@/components/EntityLibrary';
import { EntityPreview } from '@/components/EntityPreview';
import { KatanaGallery } from '@/components/KatanaGallery';
import type { DrawingScript } from '@/lib/drawing-script-schema';

export default function ItemsPage() {
  const [nonce, setNonce] = useState(0);
  const [preview, setPreview] = useState<DrawingScript | null>(null);
  const [preset, setPreset] = useState<{ prompt: string; name: string } | null>(null);
  return (
    <main>
      <h1 className="page-title">Предметы</h1>
      <EntityGenerator
        kind="item"
        title="Новый предмет"
        preset={preset}
        onSaved={(s) => {
          setNonce((n) => n + 1);
          setPreview(s);
        }}
      />
      <EntityPreview script={preview} />
      <KatanaGallery onRemix={(prompt, name) => setPreset({ prompt, name })} />
      <h2>Библиотека</h2>
      <div className="card">
        <EntityLibrary key={nonce} kind="item" />
      </div>
    </main>
  );
}
