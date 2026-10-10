import { describe, it, expect } from 'vitest';
import { PROMPT_TEMPLATES, templatesFor, getTemplate, type TemplateKind } from '@/lib/prompt-templates';
import { buildKindPrompt } from '@/lib/generate-prompts';

const KINDS: TemplateKind[] = ['character', 'item', 'location', 'scene'];

describe('PROMPT_TEMPLATES gallery', () => {
  it('offers at least 3 variants per kind with unique ids', () => {
    for (const kind of KINDS) {
      expect(templatesFor(kind).length).toBeGreaterThanOrEqual(3);
    }
    const ids = PROMPT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has a usable prompt + example name + hints', () => {
    for (const t of PROMPT_TEMPLATES) {
      expect(t.title.length).toBeGreaterThan(3);
      expect(t.prompt.length).toBeGreaterThan(40);
      expect(t.exampleName.length).toBeGreaterThan(1);
      expect(t.hints.length).toBeGreaterThan(0);
    }
  });

  it('every template prompt builds into its kind template without throw', () => {
    for (const t of PROMPT_TEMPLATES) {
      const full = buildKindPrompt(t.kind, t.prompt);
      expect(full).toContain(t.prompt.slice(0, 30));
      expect(full).toContain('DrawingScript');
    }
  });

  it('getTemplate finds by id, undefined for unknown (no fake template)', () => {
    expect(getTemplate('character-shonen-hero')?.kind).toBe('character');
    expect(getTemplate('nope')).toBeUndefined();
  });

  it('scene templates describe interaction between named actors (purmix-style)', () => {
    for (const t of templatesFor('scene')) {
      expect(t.prompt).toMatch(/Ая|Рин|Кей|герой|героиня/i);
    }
  });
});
