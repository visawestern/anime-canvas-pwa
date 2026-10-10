import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SwRegister } from '@/components/SwRegister';

describe('SwRegister', () => {
  it('registers /sw.js when enabled and supported (production PWA)', () => {
    const register = vi.fn(async () => ({}));
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register, getRegistrations: vi.fn(async () => []) },
      configurable: true,
    });
    render(<SwRegister enabled />);
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('never registers in dev, and unregisters stale workers (HMR must stay clean)', async () => {
    const unregister = vi.fn(async () => true);
    const register = vi.fn(async () => ({}));
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register, getRegistrations: vi.fn(async () => [{ unregister }]) },
      configurable: true,
    });
    render(<SwRegister enabled={false} />);
    await vi.waitFor(() => expect(unregister).toHaveBeenCalled());
    expect(register).not.toHaveBeenCalled();
  });

  it('does nothing without serviceWorker support', () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    expect(() => render(<SwRegister enabled />)).not.toThrow();
  });
});
