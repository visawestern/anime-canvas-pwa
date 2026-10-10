import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  REFERENCE_ID,
  REFERENCE_META,
  REFERENCE_BRIEF,
  REFERENCE_REMIX_PREFIX,
} from '@/lib/reference-scene';

describe('reference scene (Wikimedia Anime Girl, default remix base)', () => {
  it('checked-in file matches the analyzed stats', () => {
    const svg = fs.readFileSync(
      path.resolve(__dirname, '../../public/reference/anime-girl.svg'),
      'utf8',
    );
    const paths = (svg.match(/<path/g) ?? []).length;
    const groups = (svg.match(/<g[ >]/g) ?? []).length;
    expect(paths).toBeGreaterThan(500);
    expect(groups).toBeGreaterThan(50);
    for (const hex of REFERENCE_META.palette.slice(0, 5)) {
      expect(svg.toLowerCase()).toContain(hex.toLowerCase());
    }
    expect(REFERENCE_META.paths).toBe(paths);
    expect(REFERENCE_META.groups).toBe(groups);
  });

  it('carries CC BY 3.0 attribution (remix is legal only with credit)', () => {
    expect(REFERENCE_META.license).toMatch(/CC BY 3\.0/);
    expect(REFERENCE_META.author).toBeTruthy();
    expect(REFERENCE_META.sourceUrl).toMatch(/wikipedia|wikimedia/i);
  });

  it('brief teaches the reference construction (dutch angle, retraced contours, hair layering)', () => {
    expect(REFERENCE_BRIEF).toContain('Эталон');
    expect(REFERENCE_BRIEF).toMatch(/dutch angle|голландск/i);
    expect(REFERENCE_BRIEF).toMatch(/контур/i);
    expect(REFERENCE_BRIEF).toMatch(/сакура|sakura/i);
    for (const hex of REFERENCE_META.palette.slice(0, 3)) {
      expect(REFERENCE_BRIEF).toContain(hex);
    }
    expect(REFERENCE_ID).toBe('anime-girl');
    expect(REFERENCE_REMIX_PREFIX).toMatch(/эталон/i);
  });
});
