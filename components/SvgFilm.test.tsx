import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SvgFilm } from '@/components/SvgFilm';
import type { DrawingScript } from '@/lib/drawing-script-schema';

const script = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['construction', 'ink'],
  steps: [
    { id: 1, kind: 'pencil', layer: 'construction', strokes: [{ path: 'M0 0 L10 10', w: 1.2, o: 0.5 }] },
    { id: 2, kind: 'ink', layer: 'ink', strokes: [{ path: 'M0 0 L10 10', w: 2.4, o: 1 }] },
  ],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'idle', dirtyLayers: [] },
} as unknown as DrawingScript;

describe('SvgFilm (reference-style write-on film)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders every stroke as a timed path grouped per layer', () => {
    const { container } = render(<SvgFilm script={script} />);
    const paths = container.querySelectorAll('svg path');
    expect(paths.length).toBe(2);
    paths.forEach((p) => {
      expect(p.getAttribute('pathLength')).toBe('1');
      expect(p.getAttribute('fill')).toBe('none');
      expect(p.getAttribute('style')).toMatch(/--dl:/);
    });
    expect(container.querySelectorAll('svg > g').length).toBe(2);
    const layers = within(screen.getByTestId('film-layers'));
    expect(layers.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByTestId('film-layers').textContent).toContain('construction');
    expect(screen.getByTestId('film-layers').textContent).toContain('ink');
  });

  it('replay and speed controls work without a real animation engine', () => {
    const { container } = render(<SvgFilm script={script} />);
    fireEvent.click(screen.getByRole('button', { name: /сначала/i }));
    expect(container.querySelectorAll('svg path').length).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: /×5/i }));
    expect(screen.getByRole('button', { name: /×5/i }).className).toMatch(/on/);
  });

  it('nudge buttons move one layer without touching others', () => {
    const { container } = render(<SvgFilm script={script} />);
    const rows = within(screen.getByTestId('film-layers')).getAllByRole('listitem');
    const inkRow = rows.find((li) => li.textContent?.startsWith('ink '))!;
    fireEvent.click(within(inkRow).getByRole('button', { name: /вправо/i }));
    const html = container.innerHTML;
    expect(html).toContain('layer-ink" transform="translate(8 0)"');
    expect(html).not.toContain('layer-construction" transform');
  });

  it('shows the color phase row without nudge buttons', () => {
    const scriptFill = {
      ...script,
      steps: [
        ...script.steps,
        { id: 3, kind: 'fill', layer: 'fill', fills: [{ path: 'M0 0 L10 0 L10 10 Z', color: '#fff' }] },
      ],
    } as unknown as DrawingScript;
    render(<SvgFilm script={scriptFill} />);
    const row = screen.getByText(/заливка/).closest('li')!;
    expect(within(row).queryByRole('button')).toBeNull();
  });

  it('shows post-draw verification counts (re-check of the finished art)', () => {
    render(<SvgFilm script={script} />);
    expect(screen.getByTestId('film-check').textContent).toMatch(/путей: 2/);
    expect(screen.getByTestId('film-check').textContent).toMatch(/слоёв: 2/);
  });

  it('empty script verifies as nothing-drawn (no crash, no NaN bar)', () => {
    const empty = { ...script, steps: [] } as unknown as DrawingScript;
    render(<SvgFilm script={empty} />);
    expect(screen.getByTestId('film-check').textContent).toMatch(/empty|nothing/i);
  });
});
