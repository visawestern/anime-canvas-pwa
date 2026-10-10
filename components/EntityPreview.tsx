'use client';
import { scriptToSvg } from '@/lib/svg-film';
import { SvgFilm } from '@/components/SvgFilm';
import type { DrawingScript } from '@/lib/drawing-script-schema';

/** Visual proof of generation: the script plays as a Surbhi-style SVG write-on film. */
export function EntityPreview({ script }: { script: DrawingScript | null }) {
  if (!script) return null;
  const film = scriptToSvg(script);
  return (
    <div className="card" aria-label="Предпросмотр">
      <h3>Предпросмотр</h3>
      <p className="status">
        SVG-плёнка · шагов: {script.steps.length} · слоёв: {film.schedule.length}
      </p>
      <SvgFilm script={script} />
    </div>
  );
}
