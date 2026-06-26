import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname, useRouter } from 'next/navigation';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import MobileNav from '@/components/MobileNav';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

describe('MobileNav', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as Mock).mockReturnValue({ push: mockPush });
  });

  it('renders 4 tab buttons with correct labels', () => {
    (usePathname as Mock).mockReturnValue('/');

    render(<MobileNav />);

    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Charts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Events' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Health' })).toBeInTheDocument();
  });

  it('highlights the Home tab as active when pathname is "/"', () => {
    (usePathname as Mock).mockReturnValue('/');

    render(<MobileNav />);

    const homeButton = screen.getByRole('button', { name: 'Home' });
    const chartsButton = screen.getByRole('button', { name: 'Charts' });

    expect(homeButton.className).toContain('text-blue-600');
    expect(chartsButton.className).not.toContain('text-blue-600');
  });

  it('highlights the Charts tab as active when pathname starts with "/charts"', () => {
    (usePathname as Mock).mockReturnValue('/charts/releases');

    render(<MobileNav />);

    const chartsButton = screen.getByRole('button', { name: 'Charts' });
    const homeButton = screen.getByRole('button', { name: 'Home' });

    expect(chartsButton.className).toContain('text-blue-600');
    expect(homeButton.className).not.toContain('text-blue-600');
  });

  it('highlights the Events tab as active when pathname is "/events"', () => {
    (usePathname as Mock).mockReturnValue('/events');

    render(<MobileNav />);

    const eventsButton = screen.getByRole('button', { name: 'Events' });
    const homeButton = screen.getByRole('button', { name: 'Home' });

    expect(eventsButton.className).toContain('text-blue-600');
    expect(homeButton.className).not.toContain('text-blue-600');
  });

  it('highlights the Health tab as active when pathname starts with "/health"', () => {
    (usePathname as Mock).mockReturnValue('/health/details');

    render(<MobileNav />);

    const healthButton = screen.getByRole('button', { name: 'Health' });
    const homeButton = screen.getByRole('button', { name: 'Home' });

    expect(healthButton.className).toContain('text-blue-600');
    expect(homeButton.className).not.toContain('text-blue-600');
  });

  it('navigates to "/" when Home button is clicked', async () => {
    const user = userEvent.setup();
    (usePathname as Mock).mockReturnValue('/charts');

    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('navigates to "/charts" when Charts button is clicked', async () => {
    const user = userEvent.setup();
    (usePathname as Mock).mockReturnValue('/');

    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Charts' }));
    expect(mockPush).toHaveBeenCalledWith('/charts');
  });

  it('navigates to "/events" when Events button is clicked', async () => {
    const user = userEvent.setup();
    (usePathname as Mock).mockReturnValue('/');

    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Events' }));
    expect(mockPush).toHaveBeenCalledWith('/events');
  });

  it('navigates to "/health" when Health button is clicked', async () => {
    const user = userEvent.setup();
    (usePathname as Mock).mockReturnValue('/');

    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Health' }));
    expect(mockPush).toHaveBeenCalledWith('/health');
  });

  it('does not highlight Home when pathname is a subpath of "/" (e.g. "/charts")', () => {
    // Only exact match of "/" activates Home
    (usePathname as Mock).mockReturnValue('/charts');

    render(<MobileNav />);

    const homeButton = screen.getByRole('button', { name: 'Home' });
    expect(homeButton.className).not.toContain('text-blue-600');
  });

  it('renders the nav element with correct classes for mobile bottom nav', () => {
    (usePathname as Mock).mockReturnValue('/');

    render(<MobileNav />);

    const nav = document.querySelector('nav');
    expect(nav).toBeInTheDocument();
    expect(nav?.className).toContain('fixed');
    expect(nav?.className).toContain('bottom-0');
    expect(nav?.className).toContain('md:hidden');
  });

  it('has exactly 4 tab buttons', () => {
    (usePathname as Mock).mockReturnValue('/');

    render(<MobileNav />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
  });
});
