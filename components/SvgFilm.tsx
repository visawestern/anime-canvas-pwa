'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { scriptToSvg, highlightPartMarkup, verifyFilm } from '@/lib/svg-film';
import { saveFrame } from '@/lib/frames';
import type { DrawingScript } from '@/lib/drawing-script-schema';

function fmt(total: number): string {
  const s = Math.max(0, total);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/**
 * Reference-style write-on film: retained SVG DOM, one <g> per part drawing
 * itself in sequence. The scene stays whole with grouped parts; parts panel
 * (right side, z-order) selects (red) and reveals progressively.
 * "Сохранить кадр" snapshots the SVG; the next frame stores only the diff.
 */
export function SvgFilm({ script }: { script: DrawingScript }) {
  const [nonce, setNonce] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastFrameId, setLastFrameId] = useState<string | null>(null);
  const [frameNo, setFrameNo] = useState(0);
  const [frameStatus, setFrameStatus] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const film = useMemo(() => scriptToSvg(script), [script]);
  const svg = useMemo(() => {
    if (!selected) return film.svg;
    try {
      return highlightPartMarkup(film.svg, selected);
    } catch {
      return film.svg;
    }
  }, [film, selected]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll('path').forEach((p) => {
      const anims =
        (p as unknown as { getAnimations?: () => { playbackRate: number }[] }).getAnimations?.() ?? [];
      anims.forEach((a) => {
        a.playbackRate = speed;
      });
    });
  }, [speed, nonce, svg]);

  useEffect(() => {
    if (typeof requestAnimationFrame !== 'function') return;
    let raf = 0;
    let cancelled = false;
    const t0 = performance.now();
    const loop = (now: number) => {
      if (cancelled) return;
      const el = ((now - t0) / 1000) * speed;
      setElapsed(Math.min(film.total, el));
      if (el < film.total) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [film.total, speed, nonce]);

  async function onSaveFrame() {
    try {
      const frame = await saveFrame(film.svg, lastFrameId);
      setLastFrameId(frame.id);
      setFrameNo((n) => n + 1);
      setFrameStatus(
        frame.prevId === null
          ? `Кадр ${frameNo + 1} сохранён (полный, ${frame.bytes} bytes).`
          : frame.changed.length === 0
            ? `Кадр ${frameNo + 1} сохранён (без изменений).`
            : `Кадр ${frameNo + 1} сохранён (diff частей: ${frame.changed.length}, ${frame.bytes} bytes).`,
      );
    } catch (e) {
      setFrameStatus(`Ошибка сохранения кадра: ${(e as Error).message}`);
    }
  }

  const check = useMemo(() => verifyFilm(svg), [svg]);
  const fillsEntry = film.schedule.find((s) => s.kind === 'fills');

  return (
    <div className="card" aria-label="SVG-плёнка">
      <div className="bar-wrap">
        <div data-testid="film-bar" style={{ width: `${film.total > 0 ? (elapsed / film.total) * 100 : 0}%` }} />
      </div>
      <p data-testid="film-clock" className="status">
        {fmt(elapsed)} / {fmt(film.total)}
      </p>
      <p data-testid="film-check" className="status">
        {check.ok
          ? `Проверка: OK · путей: ${check.paths} · слоёв: ${check.layers.length}`
          : `Проверка: issues: ${check.issues.slice(0, 3).join('; ')}`}
      </p>
      <div ref={rootRef} className="svgfilm" key={nonce} data-testid="film-stage" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="btn-row">
        <button type="button" onClick={() => setNonce((n) => n + 1)}>
          ↻ Сначала
        </button>
        {[1, 2, 5, 10].map((s) => (
          <button key={s} type="button" className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>
            ×{s}
          </button>
        ))}
        <button type="button" className="btn-primary" onClick={onSaveFrame}>
          Сохранить кадр
        </button>
      </div>
      <p data-testid="frame-status" className="status">
        {frameStatus}
      </p>
      <h3>Элементы (порядок наложения: первый рисуется нижним)</h3>
      <ul className="log" data-testid="film-parts">
        {film.parts.map((p, i) => {
          const drawn = elapsed >= film.total || elapsed >= p.t;
          const isSel = selected === p.id;
          return (
            <li key={p.id} className={isSel ? 'on' : ''}>
              <button
                type="button"
                aria-label={`выбрать ${p.part}`}
                aria-pressed={isSel}
                onClick={() => setSelected(isSel ? null : p.id)}
              >
                {drawn ? '● ' : '○ '}
                {p.part}
              </button>{' '}
              <span className="badge">
                z#{i + 1} · {p.paths} лин.
              </span>
            </li>
          );
        })}
        {fillsEntry && (
          <li key="__fills">
            <span>
              {fillsEntry.label} <span className="badge">фаза 2</span>
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
