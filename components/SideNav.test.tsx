import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

import { SideNav } from '@/components/SideNav';

describe('SideNav (admin navigation)', () => {
  it('links all studio sections', () => {
    render(<SideNav active="/" />);
    for (const name of [/студия/i, /персонажи/i, /предметы/i, /места/i, /сцены/i]) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /студия/i })).toHaveClass('active');
  });
});
