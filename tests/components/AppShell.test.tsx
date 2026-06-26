import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AppShell from '@/components/AppShell';
import { useApp } from '@/contexts/AppContext';

// Mock child components
vi.mock('@/components/Header', () => ({
  default: () => <header data-testid="header">Header</header>,
}));

vi.mock('@/components/LoginScreen', () => ({
  default: ({ onLoginSuccess }: { onLoginSuccess: () => void }) => (
    <div data-testid="login-screen">
      <button data-testid="login-success-btn" onClick={onLoginSuccess}>
        Login Success
      </button>
    </div>
  ),
}));

vi.mock('@/components/MobileNav', () => ({
  default: () => <nav data-testid="mobile-nav">MobileNav</nav>,
}));

// Mock useApp
vi.mock('@/contexts/AppContext', () => ({
  useApp: vi.fn(),
}));

const mockUseApp = vi.mocked(useApp);

function createAppContext(overrides: Partial<ReturnType<typeof useApp>> = {}) {
  return {
    session: null as any,
    loadingSession: false,
    checkSession: vi.fn(),
    handleLogout: vi.fn(),
    clusters: [],
    activeCluster: null,
    handleAddCluster: vi.fn(),
    handleRemoveCluster: vi.fn(),
    handleSelectCluster: vi.fn(),
    isDarkMode: false,
    setIsDarkMode: vi.fn(),
    globalSearchQuery: '',
    setGlobalSearchQuery: vi.fn(),
    selectedNamespace: 'all',
    setSelectedNamespace: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useApp>;
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Loading state ---
  it('shows loading spinner when loadingSession is true', () => {
    mockUseApp.mockReturnValue(createAppContext({ loadingSession: true }));
    render(<AppShell>Content</AppShell>);
    // The spinner is a div with animate-spin class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(screen.getByText('Starting...')).toBeInTheDocument();
  });

  it('does not render Header when loading', () => {
    mockUseApp.mockReturnValue(createAppContext({ loadingSession: true }));
    render(<AppShell>Content</AppShell>);
    expect(screen.queryByTestId('header')).toBeNull();
  });

  // --- Unauthenticated state ---
  it('shows LoginScreen when not authenticated (session is null)', () => {
    mockUseApp.mockReturnValue(
      createAppContext({ session: null, loadingSession: false }),
    );
    render(<AppShell>Content</AppShell>);
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('shows LoginScreen when session.authenticated is false', () => {
    mockUseApp.mockReturnValue(
      createAppContext({
        session: { authenticated: false },
        loadingSession: false,
      }),
    );
    render(<AppShell>Content</AppShell>);
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('does not render Header or children when unauthenticated', () => {
    mockUseApp.mockReturnValue(
      createAppContext({
        session: { authenticated: false },
        loadingSession: false,
      }),
    );
    render(<AppShell>Content</AppShell>);
    expect(screen.queryByTestId('header')).toBeNull();
    expect(screen.queryByText('Content')).toBeNull();
  });

  // --- Authenticated state ---
  it('renders Header when authenticated', () => {
    mockUseApp.mockReturnValue(
      createAppContext({
        session: { authenticated: true, email: 't@t.com', name: 'T' },
        loadingSession: false,
      }),
    );
    render(<AppShell>Content</AppShell>);
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockUseApp.mockReturnValue(
      createAppContext({
        session: { authenticated: true, email: 't@t.com', name: 'T' },
        loadingSession: false,
      }),
    );
    render(<AppShell><p data-testid="child">Hello World</p></AppShell>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('includes MobileNav when authenticated', () => {
    mockUseApp.mockReturnValue(
      createAppContext({
        session: { authenticated: true, email: 't@t.com', name: 'T' },
        loadingSession: false,
      }),
    );
    render(<AppShell>Content</AppShell>);
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
  });

  it('does not render LoginScreen when authenticated', () => {
    mockUseApp.mockReturnValue(
      createAppContext({
        session: { authenticated: true, email: 't@t.com', name: 'T' },
        loadingSession: false,
      }),
    );
    render(<AppShell>Content</AppShell>);
    expect(screen.queryByTestId('login-screen')).toBeNull();
  });

  // --- checkSession called on mount ---
  it('calls checkSession on mount', () => {
    const checkSession = vi.fn();
    mockUseApp.mockReturnValue(createAppContext({ checkSession, loadingSession: false }));
    render(<AppShell>Content</AppShell>);
    expect(checkSession).toHaveBeenCalled();
  });
});
