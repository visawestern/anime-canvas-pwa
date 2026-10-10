import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/pencil-renderer', () => ({
  playScriptOnCanvas: vi.fn(async () => {}),
}));

import { EntityPreview } from '@/components/EntityPreview';
import { playScriptOnCanvas } from '@/lib/pencil-renderer';

const script = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['a', 'ink'],
  steps: [
    { id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 L10 10', w: 1.2, o: 0.5 }] },
    { id: 2, kind: 'ink', layer: 'ink', strokes: [{ path: 'M0 0 L10 10', w: 2.4, o: 1 }] },
  ],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'x', dirtyLayers: [] },
} as never;

describe('EntityPreview (generated art actually plays)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing without a script', () => {
    render(<EntityPreview script={null} />);
    expect(screen.queryByTestId('entity-preview')).not.toBeInTheDocument();
  });

  it('plays the script on its canvas and reports step count', async () => {
    render(<EntityPreview script={script} />);
    expect(screen.getByTestId('entity-preview').tagName).toBe('CANVAS');
    await waitFor(() => expect(playScriptOnCanvas).toHaveBeenCalled());
    const steps = vi.mocked(playScriptOnCanvas).mock.calls[0][1] as unknown[];
    expect(steps).toHaveLength(2);
    expect(screen.getByText(/2 шагов/i)).toBeInTheDocument();
  });

  it('replay button plays again', async () => {
    render(<EntityPreview script={script} />);
    await waitFor(() => expect(playScriptOnCanvas).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /переиграть/i }));
    await waitFor(() => expect(playScriptOnCanvas).toHaveBeenCalledTimes(2));
  });
});
