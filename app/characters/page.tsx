'use client';
import { useState } from 'react';
import { EntityGenerator } from '@/components/EntityGenerator';
import { EntityLibrary } from '@/components/EntityLibrary';

export default function CharactersPage() {
  const [nonce, setNonce] = useState(0);
  return (
    <main>
      <h1 className="page-title">Персонажи</h1>
      <EntityGenerator kind="character" title="Новый персонаж" onSaved={() => setNonce((n) => n + 1)} />
      <h2>Библиотека</h2>
      <div className="card">
        <EntityLibrary key={nonce} kind="character" />
      </div>
    </main>
  );
}
