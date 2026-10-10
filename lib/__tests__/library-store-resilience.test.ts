import { describe, it, expect, vi } from 'vitest';
import { saveScript, loadScript } from '@/lib/library-store';

describe('library-store resilience (no silent data loss)', () => {
  it('keeps memory copy when localStorage quota throws', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      await saveScript('q-scene', { a: 1 });
      expect(await loadScript('q-scene')).toEqual({ a: 1 });
    } finally {
      setItem.mockRestore();
    }
  });

  it('returns undefined on corrupted JSON (no crash)', async () => {
    localStorage.setItem('animecanvas:scene:broken', '{not json');
    expect(await loadScript('broken')).toBeUndefined();
  });
});
