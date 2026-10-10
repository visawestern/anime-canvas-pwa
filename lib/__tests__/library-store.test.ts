import { describe, it, expect } from 'vitest';
import { saveScript, loadScript, listScripts } from '@/lib/library-store';

describe('library-store (offline PWA library)', () => {
  it('saves and loads a script by id', async () => {
    await saveScript('scene-1', { hello: 'world' });
    expect(await loadScript('scene-1')).toEqual({ hello: 'world' });
  });

  it('returns undefined for missing scene (no fake)', async () => {
    expect(await loadScript('missing')).toBeUndefined();
  });

  it('lists saved scene ids', async () => {
    await saveScript('scene-2', { x: 1 });
    const ids = await listScripts();
    expect(ids).toContain('scene-1');
    expect(ids).toContain('scene-2');
  });
});
