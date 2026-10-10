import { describe, it, expect } from 'vitest';
import { ANIME_DIRECTOR_PROMPT } from '@/lib/anime-director-prompt';

describe('ANIME_DIRECTOR_PROMPT (risunci grounding)', () => {
  it('encodes construction order + JSON-only + dirty-layer rules', () => {
    for (const needle of [
      'skeleton',
      'hands',
      'JSON',
      'dirtyLayers',
      'pencil|ink|eraser|fill|shade',
      'fps 1..24',
    ]) {
      expect(ANIME_DIRECTOR_PROMPT).toContain(needle);
    }
  });

  it('embeds the four-site lesson canon (grades, interaction, proportions)', () => {
    for (const needle of ['B6', 'action line', 'chibi', '6-7 heads', 'LESSON CANON', 'purmix']) {
      expect(ANIME_DIRECTOR_PROMPT).toContain(needle);
    }
  });
});
