'use client';
import { useEffect, useRef, useState } from 'react';
import { playScriptOnCanvas } from '@/lib/pencil-renderer';
import type { DrawingScript } from '@/lib/drawing-script-schema';

/** Visual proof of generation: plays a DrawingScript on its own canvas, stroke by stroke. */
export function EntityPreview({ script }: { script: DrawingScript | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!script) return;
    let cancelled = false;
    const ctl = new AbortController();
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        setStatus(`Рисую: ${script.steps.length} шагов…`);
        let skipped = 0;
        await playScriptOnCanvas(canvas, script.steps, {
          signal: ctl.signal,
          onSkip: () => {
            skipped++;
          },
        });
        if (!cancelled && !ctl.signal.aborted)
          setStatus(
            `Готово: ${script.steps.length} шагов.` + (skipped > 0 ? ` Пропущено битых штрихов: ${skipped}.` : ''),
          );
      } catch (e) {
        if (!cancelled) setStatus(`Ошибка воспроизведения: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
      ctl.abort();
    };
  }, [script, nonce]);

  if (!script) return null;
  return (
    <div className="card" aria-label="Предпросмотр">
      <h3>Предпросмотр</h3>
      <canvas ref={canvasRef} width={512} height={512} data-testid="entity-preview" aria-label="Предпросмотр рисунка" />
      <div className="btn-row">
        <button type="button" onClick={() => setNonce((n) => n + 1)}>
          Переиграть
        </button>
      </div>
      <p className="status">{status}</p>
    </div>
  );
}
