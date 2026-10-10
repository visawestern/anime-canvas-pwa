import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryPanel } from '@/components/HistoryPanel';
import type { LogEntry } from '@/lib/history';

const log: LogEntry[] = [
  { seq: 1, id: 'n1', label: 'init', parentId: null, depth: 0, branch: 0, isCurrent: false },
  { seq: 2, id: 'n2', label: 'load: photo', parentId: 'n1', depth: 1, branch: 0, isCurrent: false },
  { seq: 3, id: 'n3', label: 'generate: Ая', parentId: 'n2', depth: 2, branch: 0, isCurrent: false },
  { seq: 4, id: 'n4', label: 'alt: ночь', parentId: 'n2', depth: 2, branch: 1, isCurrent: true },
];

describe('HistoryPanel (undo/redo + tree log)', () => {
  it('renders undo/redo buttons with disabled states + full log with branches', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const onJump = vi.fn();
    render(
      <HistoryPanel log={log} canUndo canRedo={false} onUndo={onUndo} onRedo={onRedo} onJump={onJump} events={[]} />,
    );
    const undo = screen.getByRole('button', { name: /отменить/i });
    const redo = screen.getByRole('button', { name: /переделать/i });
    expect(redo).toBeDisabled();
    fireEvent.click(undo);
    expect(onUndo).toHaveBeenCalledTimes(1);
    // both trees visible, branch badge on forked line
    expect(screen.getByText(/generate: Ая/)).toBeInTheDocument();
    expect(screen.getByText(/alt: ночь/)).toBeInTheDocument();
    expect(screen.getByText(/ветка 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/generate: Ая/));
    expect(onJump).toHaveBeenCalledWith('n3');
  });
});
