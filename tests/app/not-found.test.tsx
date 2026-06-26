import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import NotFound from '@/app/not-found';

describe('NotFound', () => {
  it('renders "Page not found" heading', () => {
    render(<NotFound />);
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('renders 404 text', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders "Back to Dashboard" link pointing to /', () => {
    render(<NotFound />);
    const link = screen.getByRole('link', { name: /back to dashboard/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('/');
  });

  it('renders ShieldAlert icon', () => {
    render(<NotFound />);
    const icon = document.querySelector('svg.lucide');
    expect(icon).toBeInTheDocument();
  });

  it('renders informational message', () => {
    render(<NotFound />);
    expect(
      screen.getByText("The resource you're looking for doesn't exist or has been moved."),
    ).toBeInTheDocument();
  });
});
