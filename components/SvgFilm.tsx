'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { scriptToSvg, shiftPartMarkup, highlightPartMarkup, verifyFilm } from '@/lib/svg-film';
import type { DrawingScript } from '@/lib/drawing-script-schema';

const NUDGE = 8;

function fmt(total: number): string {
  const s = Math.max(0, total);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/**
 * Reference-style write-on film: retained SVG DOM, one <g> per layer drawing
 * itself in sequence (pathLength=1 + --dl/--d). Parts panel (right side, z-order):
 * select paints every line of the part red, arrows move it with zero redraw.
 */
export function SvgFilm({ script }: { script: DrawingScript }) {
  const [nonce, setNonce] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [moves, setMoves] = useState<Record<string, { dx: number; dy: number }>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const film = useMemo(() => scriptToSvg(script), [script]);
  const svg = useMemo(() => {
    let out = film.svg;
    for (const [gid, m] of Object.entries(moves)) {
      if (m.dx !== 0 || m.dy !== 0) out = shiftPartMarkup(out, gid, m.dx, m.dy);
    }
    if (selected) out = highlightPartMarkup(out, selected);
    return out;
  }, [film, moves, selected]);

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

  const nudge = (gid: string, dx: number, dy: number) =>
    setMoves((prev) => ({ ...prev, [gid]: { dx: (prev[gid]?.dx ?? 0) + dx, dy: (prev[gid]?.dy ?? 0) + dy } }));

  const doneUpTo = (t: number) => elapsed >= film.total || elapsed >= t;
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
      </div>
      <h3>Элементы (порядок наложения: первый рисуется нижним)</h3>
      <ul className="log" data-testid="film-parts">
        {film.parts.map((p, i) => {
          const drawn = doneUpTo(p.t);
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
              </span>{' '}
              <span className="btn-row">
                <button type="button" aria-label={`влево ${p.part}`} onClick={() => nudge(p.id, -NUDGE, 0)}>
                  ◀
                </button>
                <button type="button" aria-label={`вправо ${p.part}`} onClick={() => nudge(p.id, NUDGE, 0)}>
                  ▶
                </button>
                <button type="button" aria-label={`вверх ${p.part}`} onClick={() => nudge(p.id, 0, -NUDGE)}>
                  ▲
                </button>
                <button type="button" aria-label={`вниз ${p.part}`} onClick={() => nudge(p.id, 0, NUDGE)}>
                  ▼
                </button>
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
