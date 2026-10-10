'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { scriptToSvg, shiftLayerMarkup } from '@/lib/svg-film';
import type { DrawingScript } from '@/lib/drawing-script-schema';

const NUDGE = 8;

function fmt(total: number): string {
  const s = Math.max(0, total);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/**
 * Reference-style write-on film: retained SVG DOM, one <g> per layer drawing
 * itself in sequence (pathLength=1 + --dl/--d). Parts move via <g> transform —
 * no redraw. Progress bar, clock, speed, replay, per-layer nudge.
 */
export function SvgFilm({ script }: { script: DrawingScript }) {
  const [nonce, setNonce] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [moves, setMoves] = useState<Record<string, { dx: number; dy: number }>>({});
  const [elapsed, setElapsed] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const film = useMemo(() => scriptToSvg(script), [script]);
  const svg = useMemo(() => {
    let out = film.svg;
    for (const [layer, m] of Object.entries(moves)) {
      if (m.dx !== 0 || m.dy !== 0) out = shiftLayerMarkup(out, `layer-${layer}`, m.dx, m.dy);
    }
    return out;
  }, [film, moves]);

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

  const nudge = (layer: string, dx: number, dy: number) =>
    setMoves((prev) => ({ ...prev, [layer]: { dx: (prev[layer]?.dx ?? 0) + dx, dy: (prev[layer]?.dy ?? 0) + dy } }));

  const current = [...film.schedule].reverse().find((s) => elapsed >= s.t)?.layer ?? null;

  return (
    <div className="card" aria-label="SVG-плёнка">
      <div className="bar-wrap">
        <div data-testid="film-bar" style={{ width: `${film.total > 0 ? (elapsed / film.total) * 100 : 0}%` }} />
      </div>
      <p data-testid="film-clock" className="status">
        {fmt(elapsed)} / {fmt(film.total)}
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
      <ul className="log" data-testid="film-layers">
        {film.schedule.map((s) => (
          <li key={s.layer} className={current === s.layer ? 'on' : ''}>
            <span>
              {s.layer} <span className="badge">{s.label}</span>
            </span>{' '}
            <span className="btn-row">
              <button type="button" aria-label={`влево ${s.layer}`} onClick={() => nudge(s.layer, -NUDGE, 0)}>
                ◀
              </button>
              <button type="button" aria-label={`вправо ${s.layer}`} onClick={() => nudge(s.layer, NUDGE, 0)}>
                ▶
              </button>
              <button type="button" aria-label={`вверх ${s.layer}`} onClick={() => nudge(s.layer, 0, -NUDGE)}>
                ▲
              </button>
              <button type="button" aria-label={`вниз ${s.layer}`} onClick={() => nudge(s.layer, 0, NUDGE)}>
                ▼
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
