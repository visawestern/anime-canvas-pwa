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
    <section aria-label="История">
      <div>
        <button type="button" onClick={onUndo} disabled={!canUndo}>
          Отменить
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo}>
          Переделать
        </button>
      </div>
      <ol data-testid="history-log">
        {log.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onJump(e.id)} aria-current={e.isCurrent ? 'true' : undefined}>
              {e.isCurrent ? '● ' : '○ '}
              {e.label}
            </button>{' '}
            {e.branch > 0 && <span>ветка {e.branch}</span>}
            <span> · глубина {e.depth}</span>
          </li>
        ))}
      </ol>
      {events.length > 0 && (
        <ul data-testid="event-log">
          {events.map((ev, i) => (
            <li key={i}>{ev}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
