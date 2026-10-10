import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CanvasStage } from '@/components/CanvasStage';

describe('CanvasStage (one canvas invariant)', () => {
  it('renders exactly one canvas + upload input + status', () => {
    render(<CanvasStage />);
    expect(screen.getByTestId('anime-canvas').tagName).toBe('CANVAS');
    expect(document.querySelectorAll('canvas')).toHaveLength(1);
    expect(screen.getByLabelText(/загрузить фото/i)).toBeInTheDocument();
    expect(screen.getByTestId('stage-status')).toBeInTheDocument();
  });

  it('uses the admin card theme like other pages (no unstyled section)', () => {
    const { container } = render(<CanvasStage />);
    expect(container.querySelector('section.card')).toBeInTheDocument();
  });
});
