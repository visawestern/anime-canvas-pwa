/**
 * Browser-only SVG -> PNG rasterizer so reference art can be auto-substituted
 * into Gemma vision (no server-side rasterizer available: no rsvg/inkscape/chromium).
 */

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`reference image failed to load: ${String(e)}`));
    img.src = url;
  });
}

/** Render SVG markup to a base64 PNG (without the data-URL prefix) at given width. */
export async function svgToPngBase64(svgText: string, width = 768): Promise<string> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    throw new Error('svg rasterization needs a browser (Image + canvas)');
  }
  const sized = /<svg(?![^>]*\bwidth=)/.test(svgText)
    ? svgText.replace(/<svg(?![^>]*\bwidth=)/, `<svg width="${width}"`)
    : svgText;
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await loadImage(url);
    const scale = width / (img.width || width);
    const height = Math.max(1, Math.round((img.height || width) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable for rasterization');
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/png');
    const b64 = dataUrl.split(',')[1];
    if (!b64) throw new Error('rasterization produced empty output');
    return b64;
  } finally {
    URL.revokeObjectURL(url);
  }
}
