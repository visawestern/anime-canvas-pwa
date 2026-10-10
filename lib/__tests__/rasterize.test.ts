import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { svgToPngBase64 } from '@/lib/rasterize';

function mockBrowser(toDataURL = 'data:image/png;base64,AAA') {
  const drawImage = vi.fn();
  const getContext = vi.fn(() => ({ drawImage }));
  const origCreate = document.createElement.bind(document);
  const createSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag === 'canvas') return { width: 0, height: 0, getContext, toDataURL: () => toDataURL } as unknown as HTMLCanvasElement;
    return origCreate(tag);
  }) as typeof document.createElement);
  class Img {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 100;
    height = 50;
    set src(_v: string) {
      setTimeout(() => this.onload?.(), 0);
    }
  }
  vi.stubGlobal('Image', Img as unknown as typeof Image);
  const U = URL as unknown as Record<string, unknown>;
  if (typeof U.createObjectURL !== 'function') U.createObjectURL = vi.fn(() => 'blob:mock');
  if (typeof U.revokeObjectURL !== 'function') U.revokeObjectURL = vi.fn();
  return { createSpy, drawImage };
}

describe('svgToPngBase64 (browser rasterizer for vision remix)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders svg text to a png data URL at requested width (keeps aspect)', async () => {
    const { drawImage } = mockBrowser();
    const out = await svgToPngBase64('<svg viewBox="0 0 100 50"><path d="M0 0 L10 10"/></svg>', 200);
    expect(out).toBe('AAA');
    expect(drawImage).toHaveBeenCalledTimes(1);
  });

  it('throws honest error outside a browser (no silent fake pixels)', async () => {
    vi.stubGlobal('Image', undefined as never);
    await expect(svgToPngBase64('<svg></svg>', 200)).rejects.toThrow(/browser/i);
  });

  it('throws when the image fails to load (broken svg)', async () => {
    const getContext = vi.fn(() => ({ drawImage: vi.fn() }));
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'canvas') {
        return { width: 0, height: 0, getContext, toDataURL: () => 'x' } as unknown as HTMLCanvasElement;
      }
      return document.createElement(tag);
    }) as typeof document.createElement);
    class BadImg {
      onload: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      set src(_v: string) {
        setTimeout(() => this.onerror?.(new Error('nope')), 0);
      }
    }
    vi.stubGlobal('Image', BadImg as unknown as typeof Image);
    await expect(svgToPngBase64('<svg></svg>', 200)).rejects.toThrow();
    vi.restoreAllMocks();
  });
});
