import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KatanaGallery } from '@/components/KatanaGallery';
import type { KatanaPiece } from '@/lib/katana-reference';

describe('KatanaGallery (decomposed pack + scene example)', () => {
  it('shows all 7 pieces with remix buttons and the scene example', () => {
    const onRemix = vi.fn();
    render(<KatanaGallery onRemix={onRemix} busy={false} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBeGreaterThanOrEqual(8); // 7 pieces + scene example
    expect(screen.getByText(/ножнами/i)).toBeInTheDocument();
  });

  it('passes the piece plus user changes for vision remix (reference auto-substituted)', () => {
    const onRemix = vi.fn();
    render(<KatanaGallery onRemix={onRemix} busy={false} />);
    fireEvent.change(screen.getByLabelText(/что изменить/i), { target: { value: 'красная рукоять' } });
    fireEvent.click(screen.getAllByRole('button', { name: /взять за основу/i })[0]);
    expect(onRemix).toHaveBeenCalledTimes(1);
    const [piece, extra] = onRemix.mock.calls[0] as [KatanaPiece, string];
    expect(piece.id).toBe('katana-01');
    expect(extra).toContain('красная рукоять');
  });
});
