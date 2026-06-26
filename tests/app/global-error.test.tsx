import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import GlobalError from '@/app/global-error';

describe('GlobalError', () => {
  const mockError = new Error('Test error') as Error & { digest?: string };
  mockError.digest = 'abc123';

  it('renders "Something went wrong" heading', () => {
    render(<GlobalError error={mockError} reset={vi.fn()} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders 500 text', () => {
    render(<GlobalError error={mockError} reset={vi.fn()} />);
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('renders "Try again" button', () => {
    render(<GlobalError error={mockError} reset={vi.fn()} />);
    const button = screen.getByRole('button', { name: /try again/i });
    expect(button).toBeInTheDocument();
  });

  it('calls reset when "Try again" button is clicked', async () => {
    const reset = vi.fn();
    const user = userEvent.setup();

    render(<GlobalError error={mockError} reset={reset} />);
    const button = screen.getByRole('button', { name: /try again/i });
    await user.click(button);

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('renders error message text', () => {
    render(<GlobalError error={mockError} reset={vi.fn()} />);
    expect(
      screen.getByText('An unexpected error occurred. Please try again.'),
    ).toBeInTheDocument();
  });

  it('renders AlertTriangle icon', () => {
    render(<GlobalError error={mockError} reset={vi.fn()} />);
    const icon = document.querySelector('svg.lucide');
    expect(icon).toBeInTheDocument();
  });

  it('renders RefreshCw icon inside button', () => {
    render(<GlobalError error={mockError} reset={vi.fn()} />);
    const button = screen.getByRole('button', { name: /try again/i });
    const icon = button.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('renders html tag with lang=en', () => {
    render(<GlobalError error={mockError} reset={vi.fn()} />);
    const html = document.querySelector('html');
    expect(html).toBeInTheDocument();
    expect(html!.getAttribute('lang')).toBe('en');
  });

  it('logs error to console.error on mount', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<GlobalError error={mockError} reset={vi.fn()} />);

    expect(consoleSpy).toHaveBeenCalledWith('Unhandled error:', mockError);

    consoleSpy.mockRestore();
  });
});
