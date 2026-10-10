'use client';
import type { LogEntry } from '@/lib/history';

export interface HistoryPanelProps {
  log: LogEntry[];
  events: string[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onJump: (id: string) => void;
}

/** Undo/redo buttons + full event/commit log with branch badges (local github analog). */
export function HistoryPanel({ log, events, canUndo, canRedo, onUndo, onRedo, onJump }: HistoryPanelProps) {
  return (
    <section aria-label="История" className="card">
      <h3>История (отменить · переделать · ветки)</h3>
      <div className="btn-row">
        <button type="button" onClick={onUndo} disabled={!canUndo}>
          Отменить
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo}>
          Переделать
        </button>
      </div>
      <ol data-testid="history-log" className="log">
        {log.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onJump(e.id)} aria-current={e.isCurrent ? 'true' : undefined}>
              {e.isCurrent ? '● ' : '○ '}
              {e.label}
            </button>{' '}
            {e.branch > 0 && <span className="badge badge-branch">ветка {e.branch}</span>}
            {e.isCurrent && <span className="badge badge-current">текущая</span>}
            <span className="badge">глубина {e.depth}</span>
          </li>
        ))}
      </ol>
      {events.length > 0 && (
        <ul data-testid="event-log" className="log">
          {events.map((ev, i) => (
            <li key={i}>{ev}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
