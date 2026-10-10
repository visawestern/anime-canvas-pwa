import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KatanaGallery } from '@/components/KatanaGallery';

describe('KatanaGallery (decomposed pack + scene example)', () => {
  it('shows all 7 pieces with remix buttons and the scene example', () => {
    const onRemix = vi.fn();
    render(<KatanaGallery onRemix={onRemix} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBeGreaterThanOrEqual(8); // 7 pieces + scene example
    expect(screen.getByText(/ножнами/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /взять за основу/i })[0]);
    expect(onRemix).toHaveBeenCalledTimes(1);
    const [prompt, name] = onRemix.mock.calls[0] as [string, string];
    expect(prompt).toContain('katana-01');
    expect(name.length).toBeGreaterThan(1);
  });
});
