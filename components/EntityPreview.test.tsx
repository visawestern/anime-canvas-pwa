import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntityPreview } from '@/components/EntityPreview';

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
    expect(screen.queryByTestId('film-stage')).not.toBeInTheDocument();
  });

  it('plays the script as an SVG film and reports steps/layers', () => {
    const { container } = render(<EntityPreview script={script} />);
    expect(container.querySelectorAll('svg path').length).toBe(2);
    expect(screen.getByText(/шагов: 2/)).toBeInTheDocument();
    expect(screen.getByText(/слоёв: 2/)).toBeInTheDocument();
  });

  it('replay button keeps the film intact', () => {
    const { container } = render(<EntityPreview script={script} />);
    fireEvent.click(screen.getByRole('button', { name: /сначала/i }));
    expect(container.querySelectorAll('svg path').length).toBe(2);
  });
});
