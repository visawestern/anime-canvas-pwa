'use client';
import { useEffect, useReducer, useRef, useState } from 'react';
import { DrawingScriptSchema, type DrawingScript } from '@/lib/drawing-script-schema';
import { playScriptOnCanvas } from '@/lib/pencil-renderer';
import { startCelLoop } from '@/lib/cel-engine';
import { saveScript } from '@/lib/library-store';
import { HistoryTree } from '@/lib/history';
import { HistoryPanel } from '@/components/HistoryPanel';

const MAX_EVENTS = 200;

/** Single-canvas stage: upload photo -> DrawingScript -> pencil film -> cel loop, with undo/redo tree. */
export function CanvasStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<HistoryTree<DrawingScript | null> | null>(null);
  if (!historyRef.current) historyRef.current = new HistoryTree<DrawingScript | null>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);

  const [status, setStatus] = useState<string>('Готов. Загрузи фото.');
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const [replay, setReplay] = useState<{ script: DrawingScript; nonce: number } | null>(null);

  const history = historyRef.current;

  function logEvent(text: string) {
    setEvents((prev) => [...prev.slice(-(MAX_EVENTS - 1)), `${new Date().toLocaleTimeString('ru-RU')}: ${text}`]);
  }

  function showScript(script: DrawingScript, headline: string) {
    setSteps(script.steps.map((s) => `${s.kind}: ${s.label ?? s.layer}`));
    setStatus(headline);
  }

  async function play(script: DrawingScript, headline: string) {
    stopAll();
    showScript(script, headline);
    const ctl = new AbortController();
    abortRef.current = ctl;
    let skipped = 0;
    await playScriptOnCanvas(canvasRef.current!, script.steps, {
      signal: ctl.signal,
      onStep: (s, i, total) => setStatus(`Шаг ${i + 1}/${total} — ${s.kind}: ${s.label ?? s.layer}`),
      onSkip: () => {
        skipped++;
      },
    });
    if (!ctl.signal.aborted)
      setStatus(
        `Готово. Нажми «Анимировать» — задвигаются только ${script.anim.dirtyLayers.join(', ') || 'магия'}.` +
          (skipped > 0 ? ` Пропущено битых штрихов: ${skipped}.` : ''),
      );
  }

  // view-only replay after undo/redo/jump: moves the pointer, commits nothing
  useEffect(() => {
    if (!replay) return;
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      stopAll();
      showScript(replay.script, `Восстановлено из истории (${replay.script.steps.length} шагов). Проигрываю…`);
      const ctl = new AbortController();
      abortRef.current = ctl;
      await playScriptOnCanvas(canvas, replay.script.steps, { signal: ctl.signal });
      if (!cancelled && !ctl.signal.aborted) setStatus('Восстановлено из истории.');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay]);

  function stopAll() {
    abortRef.current?.abort();
    abortRef.current = null;
    setAnimating(false);
  }

  async function onFile(file: File) {
    stopAll();
    setBusy(true);
    try {
      setStatus('Читаю фото…');
      const b64 = await fileToBase64(file);
      setStatus('Gemma анализирует позу…');
      const res = await fetch('/api/draw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Ошибка: ${data.error}`);
        logEvent(`ошибка загрузки: ${data.error}`);
        return;
      }
      const script = DrawingScriptSchema.parse(data);
      const id = `scene-${Date.now()}`;
      await saveScript(id, script);
      history.commit(`load: ${id} (${script.steps.length} шагов)`, script);
      logEvent(`загружена сцена ${id}`);
      bump();
      await play(script, `Сцена ${id}: ${script.steps.length} шагов. Рисую карандашом…`);
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
      logEvent(`ошибка: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function restoreFromHistory(label: string, fn: () => DrawingScript | null) {
    stopAll();
    const script = fn();
    bump();
    if (!script) {
      const canvas = canvasRef.current;
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      setSteps([]);
      setStatus('История: пустой холст (корень).');
      logEvent(label);
      return;
    }
    logEvent(label);
    setReplay({ script, nonce: Date.now() });
  }

  function onUndo() {
    restoreFromHistory('отмена', () => history.undo());
  }

  function onRedo() {
    restoreFromHistory('повтор', () => history.redo());
  }

  function onJump(id: string) {
    restoreFromHistory(`переход к ${id}`, () => history.jumpTo(id));
  }

  async function onAnimate() {
    const canvas = canvasRef.current;
    if (!canvas || animating) return;
    setAnimating(true);
    logEvent('анимация запущена (12 fps, только движущиеся слои)');
    setStatus('Анимация: статика заморожена, перерисовываю только движущиеся слои (12 fps)…');
    const ctl = new AbortController();
    abortRef.current = ctl;
    await startCelLoop(canvas, { fps: 12, signal: ctl.signal });
    setAnimating(false);
    setStatus('Стоп. Сцена заморожена.');
    logEvent('анимация остановлена');
    bump();
  }

  return (
    <section className="card" aria-label="Холст">
      <h2 className="page-title">Студия</h2>
      <p className="page-sub">Загрузи фото — Gemma разберёт позу, Canvas нарисует аниме штрих за штрихом.</p>
      <canvas ref={canvasRef} width={512} height={512} data-testid="anime-canvas" aria-label="Аниме-холст" />
      <div className="btn-row">
        <input
          type="file"
          accept="image/*"
          aria-label="Загрузить фото"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <button type="button" className="btn-primary" onClick={onAnimate} disabled={animating || steps.length === 0}>
          Анимировать (только движущиеся слои)
        </button>
        <button type="button" onClick={stopAll}>
          Стоп
        </button>
      </div>
      <p data-testid="stage-status" className="status">{status}</p>
      <ol className="list">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <HistoryPanel
        log={history.log()}
        events={events}
        canUndo={history.canUndo()}
        canRedo={history.canRedo()}
        onUndo={onUndo}
        onRedo={onRedo}
        onJump={onJump}
      />
    </section>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
