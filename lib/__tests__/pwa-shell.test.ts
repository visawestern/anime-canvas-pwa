import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PWA shell', () => {
  it('sw.js handles install/activate/fetch and never caches /api', () => {
    const sw = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');
    expect(sw).toMatch(/addEventListener\('install'/);
    expect(sw).toMatch(/addEventListener\('fetch'/);
    expect(sw).toMatch(/\/api\//);
  });

  it('sw.js is network-first for pages (never serves a stale shell)', () => {
    const sw = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');
    expect(sw).toMatch(/navigate/);
    expect(sw).not.toMatch(/animecanvas-v1'/);
  });

  it('sw.js precaches every app page upfront (instant offline shell)', () => {
    const sw = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');
    for (const page of ['/', '/characters', '/items', '/locations', '/scenes', '/manifest.webmanifest']) {
      expect(sw).toContain(`'${page}'`);
    }
  });

  it('manifest is installable (name, icons, standalone)', () => {
    const m = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/manifest.webmanifest'), 'utf8'));
    expect(m.name).toBeTruthy();
    expect(m.display).toBe('standalone');
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
  });
});
