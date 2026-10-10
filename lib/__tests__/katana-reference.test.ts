import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { KATANA_PIECES, KATANA_BRIEF, KATANA_REMIX_PREFIX, KATANA_SCENE } from '@/lib/katana-reference';

describe('katana references (decomposed pack + scene example)', () => {
  it('inventory holds 7 standalone pieces with real geometry', () => {
    expect(KATANA_PIECES).toHaveLength(7);
    for (const p of KATANA_PIECES) {
      expect(p.paths).toBeGreaterThan(0);
      expect(p.bbox[2]).toBeGreaterThan(0);
      expect(p.bbox[3]).toBeGreaterThan(0);
      const svg = fs.readFileSync(path.resolve(__dirname, '../../public', p.file.replace(/^\//, '')), 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox');
      expect((svg.match(/<path/g) ?? []).length).toBeGreaterThan(0);
    }
  });

  it('scene example file exists and is substantial', () => {
    const svg = fs.readFileSync(path.resolve(__dirname, '../../public', KATANA_SCENE.file.replace(/^\//, '')), 'utf8');
    expect(svg.length).toBeGreaterThan(100000);
    expect(KATANA_SCENE.caption).toMatch(/ножн|сая|комнат/i);
  });

  it('brief teaches katana construction (tsuka/tsuba/blade/hamon/saya)', () => {
    expect(KATANA_BRIEF).toMatch(/tsuka|рукоят/i);
    expect(KATANA_BRIEF).toMatch(/blade|клин/i);
    expect(KATANA_BRIEF).toMatch(/hamon|дол/i);
    expect(KATANA_BRIEF).toMatch(/saya|ножн/i);
    expect(KATANA_REMIX_PREFIX).toMatch(/катан/i);
  });
});
