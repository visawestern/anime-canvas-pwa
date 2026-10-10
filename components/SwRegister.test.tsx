import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SwRegister } from '@/components/SwRegister';

describe('SwRegister', () => {
  it('registers /sw.js when supported', () => {
    const register = vi.fn(async () => ({}));
    Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });
    render(<SwRegister />);
    expect(register).toHaveBeenCalledWith('/sw.js');
  });
});
