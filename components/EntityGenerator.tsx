'use client';
import { useState } from 'react';
import { DrawingScriptSchema } from '@/lib/drawing-script-schema';
import { saveEntity, type EntityKind } from '@/lib/entities';
import type { GenerateKind } from '@/lib/generate-prompts';

export interface EntityGeneratorProps {
  kind: EntityKind;
  title: string;
  onSaved?: () => void;
}

/** New character/item/location from a text prompt: generate -> validate -> save to library. */
export function EntityGenerator({ kind, title, onSaved }: EntityGeneratorProps) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function onGenerate() {
    if (!name.trim() || !prompt.trim()) {
      setStatus('Укажи имя и промпт — из пустоты не рисуем.');
      return;
    }
    setBusy(true);
    setStatus('Gemma рисует по промпту…');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'generation failed');
      const script = DrawingScriptSchema.parse(data);
      await saveEntity({ kind, name: name.trim(), script });
      setStatus(`Сохранено в библиотеку: ${name.trim()}.`);
      onSaved?.();
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      <label>
        Имя
        <input aria-label="Имя" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ая" />
      </label>
      <label>
        Промпт
        <textarea aria-label="Промпт" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="девочка-волшебница с посохом" />
      </label>
      <button type="button" onClick={onGenerate} disabled={busy}>
        Нарисовать
      </button>
      <p>{status}</p>
    </section>
  );
}
