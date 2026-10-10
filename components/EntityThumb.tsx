'use client';
import { useEffect, useRef } from 'react';
import { renderScriptStatic } from '@/lib/pencil-renderer';
import type { DrawingScript } from '@/lib/drawing-script-schema';

/** Library avatar: instant static render of the saved script on a small canvas. */
export function EntityThumb({ script, size = 96 }: { script: DrawingScript; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // thumbnails draw simplified geometry (Surbhi lesson: few anchors draw cleaner)
      renderScriptStatic(canvas, script.steps, { simplify: 1.5 });
    } catch {
      // thumbnail is best-effort; the film view reports real errors
    }
  }, [script]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      data-testid="entity-thumb"
      aria-label="Миниатюра рисунка"
      className="thumb"
    />
  );
}
