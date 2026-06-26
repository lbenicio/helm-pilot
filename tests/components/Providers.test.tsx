import { render, screen } from '@testing-library/react';
import React from 'react';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/contexts/AppContext', () => ({
  AppProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-provider">{children}</div>
  ),
}));

vi.mock('@/components/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

// Dynamic import after mocks are set up
const Providers = (await import('@/components/Providers')).default;

describe('Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children inside AppShell inside AppProvider', () => {
    render(
      <Providers>
        <span data-testid="child">Hello World</span>
      </Providers>,
    );

    const child = screen.getByTestId('child');
    const appProvider = screen.getByTestId('app-provider');
    const appShell = screen.getByTestId('app-shell');

    expect(child).toBeInTheDocument();
    expect(child.textContent).toBe('Hello World');
    expect(appProvider).toBeInTheDocument();
    expect(appShell).toBeInTheDocument();
  });

  it('wraps children in the correct nesting order: AppProvider > AppShell > children', () => {
    render(
      <Providers>
        <span data-testid="nested-child">Nested</span>
      </Providers>,
    );

    const appProvider = screen.getByTestId('app-provider');
    const appShell = screen.getByTestId('app-shell');
    const child = screen.getByTestId('nested-child');

    // AppProvider contains AppShell
    expect(appProvider.contains(appShell)).toBe(true);
    // AppShell contains the child
    expect(appShell.contains(child)).toBe(true);
  });

  it('renders multiple children correctly', () => {
    render(
      <Providers>
        <span data-testid="child-1">One</span>
        <span data-testid="child-2">Two</span>
      </Providers>,
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
  });

  it('renders without children (empty fragment)', () => {
    render(<Providers>{null}</Providers>);

    expect(screen.getByTestId('app-provider')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });

  it('does not throw when children is undefined', () => {
    expect(() => render(<Providers>{undefined}</Providers>)).not.toThrow();
  });
});
