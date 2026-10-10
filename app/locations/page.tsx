'use client';
import { useState } from 'react';
import { EntityGenerator } from '@/components/EntityGenerator';
import { EntityLibrary } from '@/components/EntityLibrary';

export default function LocationsPage() {
  const [nonce, setNonce] = useState(0);
  return (
    <main>
      <h1>Места действия</h1>
      <EntityGenerator kind="location" title="Новое место" onSaved={() => setNonce((n) => n + 1)} />
      <h2>Библиотека</h2>
      <EntityLibrary key={nonce} kind="location" />
    </main>
  );
}
