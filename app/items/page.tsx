'use client';
import { useState } from 'react';
import { EntityGenerator } from '@/components/EntityGenerator';
import { EntityLibrary } from '@/components/EntityLibrary';

export default function ItemsPage() {
  const [nonce, setNonce] = useState(0);
  return (
    <main>
      <h1>Предметы</h1>
      <EntityGenerator kind="item" title="Новый предмет" onSaved={() => setNonce((n) => n + 1)} />
      <h2>Библиотека</h2>
      <EntityLibrary key={nonce} kind="item" />
    </main>
  );
}
