'use client';
import { useState } from 'react';
import { DrawingScriptSchema } from '@/lib/drawing-script-schema';
import { saveEntity, type EntityKind } from '@/lib/entities';
import { templatesFor, getTemplate } from '@/lib/prompt-templates';

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
  const templates = templatesFor(kind);

  function onTemplate(id: string) {
    const t = getTemplate(id);
    if (!t) return;
    setPrompt(t.prompt);
    if (!name.trim()) setName(t.exampleName);
    setStatus(`Шаблон: ${t.title}. ${t.hints.join(' · ')}`);
  }

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
    <section aria-label={title} className="card">
      <h2>{title}</h2>
      <label>
        Шаблон
        <select aria-label="Шаблон" defaultValue="" onChange={(e) => onTemplate(e.target.value)}>
          <option value="">Свой промпт…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} — напр. «{t.exampleName}»
            </option>
          ))}
        </select>
      </label>
      <label>
        Имя
        <input aria-label="Имя" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ая" />
      </label>
      <label>
        Промпт
        <textarea aria-label="Промпт" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="девочка-волшебница с посохом" />
      </label>
      <button type="button" className="btn-primary" onClick={onGenerate} disabled={busy}>
        Нарисовать
      </button>
      <p className="status">{status}</p>
    </section>
  );
}
