import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock package.json version import
vi.mock('@/../package.json', () => ({ default: { version: '1.0.0-test' } }));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useRouter: () => ({ push: mockPush }),
}));

// Mock motion/react to avoid animation-related issues in tests
vi.mock('motion/react', () => ({
  motion: {
    div: 'div',
    button: 'button',
  },
}));

// Mock ClusterSelector
vi.mock('@/components/ClusterSelector', () => ({
  default: () => <div data-testid="cluster-selector">ClusterSelector</div>,
}));

// Mock ContextMenu
vi.mock('@/components/ContextMenu', () => ({
  default: ({ x, y, options, onClose }: any) => (
    <div data-testid="context-menu" style={{ top: y, left: x }}>
      {options.map((opt: any, i: number) => (
        <button key={i} data-testid={`ctx-option-${i}`} onClick={() => { opt.onClick(); onClose(); }}>
          {opt.label}
        </button>
      ))}
    </div>
  ),
}));

import { usePathname } from 'next/navigation';

import Header from '@/components/Header';
import { useApp } from '@/contexts/AppContext';

// Mock useApp
vi.mock('@/contexts/AppContext', () => ({
  useApp: vi.fn(),
}));

const mockUseApp = vi.mocked(useApp);
const mockUsePathname = vi.mocked(usePathname);

// Set up clipboard mock once at module level (cannot redefine in beforeEach)
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
  configurable: true,
});

function createDefaultAppContext(overrides: Partial<ReturnType<typeof useApp>> = {}) {
  return {
    session: { authenticated: true, email: 'test@example.com', name: 'Test User' },
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

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/');
    mockUseApp.mockReturnValue(createDefaultAppContext());
  });

  // --- Logo ---
  it('renders the Helm Pilot logo and version', () => {
    render(<Header />);
    expect(screen.getByText('Helm Pilot')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0-test')).toBeInTheDocument();
  });

  // --- Nav buttons ---
  it('renders the Dashboard, Charts, Events, and Health nav buttons', () => {
    render(<Header />);
    const nav = document.querySelector('header nav') as HTMLElement;
    expect(within(nav).getByText('Dashboard')).toBeInTheDocument();
    expect(within(nav).getByText('Charts')).toBeInTheDocument();
    expect(within(nav).getByText('Events')).toBeInTheDocument();
    expect(within(nav).getByText('Health')).toBeInTheDocument();
  });

  // --- Active state highlighting ---
  it('highlights Dashboard as active when on /', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Header />);
    const nav = document.querySelector('header nav') as HTMLElement;
    const dashboardBtn = within(nav).getByText('Dashboard').closest('button') as HTMLElement;
    expect(dashboardBtn.className).toContain('bg-blue-600');
  });

  it('highlights Charts as active when on /charts', () => {
    mockUsePathname.mockReturnValue('/charts');
    render(<Header />);
    const nav = document.querySelector('header nav') as HTMLElement;
    const chartsBtn = within(nav).getByText('Charts').closest('button') as HTMLElement;
    expect(chartsBtn.className).toContain('bg-blue-600');
  });

  it('highlights Events as active when on /events', () => {
    mockUsePathname.mockReturnValue('/events');
    render(<Header />);
    const nav = document.querySelector('header nav') as HTMLElement;
    const eventsBtn = within(nav).getByText('Events').closest('button') as HTMLElement;
    expect(eventsBtn.className).toContain('bg-blue-600');
  });

  it('highlights Health as active when on /health', () => {
    mockUsePathname.mockReturnValue('/health');
    render(<Header />);
    const nav = document.querySelector('header nav') as HTMLElement;
    const healthBtn = within(nav).getByText('Health').closest('button') as HTMLElement;
    expect(healthBtn.className).toContain('bg-blue-600');
  });

  it('does not highlight any nav button as active when on /search', () => {
    mockUsePathname.mockReturnValue('/search');
    render(<Header />);
    const nav = document.querySelector('header nav') as HTMLElement;
    const navButtons = ['Dashboard', 'Charts', 'Events', 'Health'];
    for (const label of navButtons) {
      const btn = within(nav).getByText(label).closest('button') as HTMLElement;
      expect(btn.className).not.toContain('bg-blue-600');
    }
  });

  // --- Nav button click navigation ---
  it.each([
    { label: 'Dashboard', path: '/' },
    { label: 'Charts', path: '/charts' },
    { label: 'Events', path: '/events' },
    { label: 'Health', path: '/health' },
  ])('clicking $label navigates to $path', async ({ label, path }) => {
    const user = userEvent.setup();
    render(<Header />);
    // Find the nav button by text within the header nav
    const nav = document.querySelector('header nav') as HTMLElement;
    const btn = within(nav).getByText(label);
    await user.click(btn);
    expect(mockPush).toHaveBeenCalledWith(path);
  });

  // --- Search input ---
  it('renders a search input', () => {
    render(<Header />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('search input reflects globalSearchQuery from context', () => {
    mockUseApp.mockReturnValue(
      createDefaultAppContext({ globalSearchQuery: 'nginx' }),
    );
    render(<Header />);
    const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
    expect(input.value).toBe('nginx');
  });

  it('typing in search input calls setGlobalSearchQuery', async () => {
    const setGlobalSearchQuery = vi.fn();
    mockUseApp.mockReturnValue(
      createDefaultAppContext({ setGlobalSearchQuery }),
    );
    const user = userEvent.setup();
    render(<Header />);
    const input = screen.getByPlaceholderText('Search...');
    await user.type(input, 'hello');
    expect(setGlobalSearchQuery).toHaveBeenCalled();
  });

  it('shows clear button when search has value', () => {
    mockUseApp.mockReturnValue(
      createDefaultAppContext({ globalSearchQuery: 'something' }),
    );
    render(<Header />);
    // The clear button is the X icon button
    const clearBtn = document.querySelector('header button .lucide-x')?.closest('button');
    expect(clearBtn).toBeInTheDocument();
  });

  it('clicking clear button resets search query', async () => {
    const setGlobalSearchQuery = vi.fn();
    mockUseApp.mockReturnValue(
      createDefaultAppContext({ globalSearchQuery: 'test-query', setGlobalSearchQuery }),
    );
    const user = userEvent.setup();
    render(<Header />);
    const clearBtn = document.querySelector('header button .lucide-x')?.closest('button');
    if (clearBtn) {
      await user.click(clearBtn);
      expect(setGlobalSearchQuery).toHaveBeenCalledWith('');
    }
  });

  it('pressing Enter in search navigates to /search with query', async () => {
    mockUseApp.mockReturnValue(
      createDefaultAppContext({ globalSearchQuery: 'redis' }),
    );
    const user = userEvent.setup();
    render(<Header />);
    const input = screen.getByPlaceholderText('Search...');
    await user.click(input);
    await user.keyboard('{Enter}');
    expect(mockPush).toHaveBeenCalledWith('/search?q=redis');
  });

  it('pressing Enter with empty search does not navigate', async () => {
    mockUseApp.mockReturnValue(
      createDefaultAppContext({ globalSearchQuery: '' }),
    );
    const user = userEvent.setup();
    render(<Header />);
    const input = screen.getByPlaceholderText('Search...');
    await user.click(input);
    await user.keyboard('{Enter}');
    expect(mockPush).not.toHaveBeenCalled();
  });

  // --- Cluster selector presence ---
  it('renders the ClusterSelector component', () => {
    render(<Header />);
    expect(screen.getByTestId('cluster-selector')).toBeInTheDocument();
  });

  // --- Dark mode toggle ---
  it('renders dark mode toggle button', () => {
    render(<Header />);
    // In light mode, it shows Moon icon
    const toggleBtn = document.querySelector('header .lucide-moon, header .lucide-sun')?.closest('button');
    expect(toggleBtn).toBeInTheDocument();
  });

  it('shows Sun icon when in dark mode', () => {
    mockUseApp.mockReturnValue(createDefaultAppContext({ isDarkMode: true }));
    render(<Header />);
    const sunIcon = document.querySelector('header .lucide-sun');
    expect(sunIcon).toBeInTheDocument();
  });

  it('shows Moon icon when in light mode', () => {
    mockUseApp.mockReturnValue(createDefaultAppContext({ isDarkMode: false }));
    render(<Header />);
    const moonIcon = document.querySelector('header .lucide-moon');
    expect(moonIcon).toBeInTheDocument();
  });

  it('clicking dark mode toggle calls setIsDarkMode', async () => {
    const setIsDarkMode = vi.fn();
    mockUseApp.mockReturnValue(
      createDefaultAppContext({ isDarkMode: false, setIsDarkMode }),
    );
    const user = userEvent.setup();
    render(<Header />);
    const toggleBtn = document.querySelector('header .lucide-moon')?.closest('button') as HTMLElement;
    await user.click(toggleBtn);
    expect(setIsDarkMode).toHaveBeenCalledWith(true);
  });

  // --- Logout when session exists ---
  it('renders logout button when session exists', () => {
    render(<Header />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
    const logoutBtn = document.querySelector('header .lucide-log-out')?.closest('button');
    expect(logoutBtn).toBeInTheDocument();
  });

  it('does not render logout button when no session', () => {
    mockUseApp.mockReturnValue(createDefaultAppContext({ session: null }));
    render(<Header />);
    const logoutIcon = document.querySelector('header .lucide-log-out');
    expect(logoutIcon).toBeNull();
  });

  it('clicking logout button calls handleLogout', async () => {
    const handleLogout = vi.fn();
    mockUseApp.mockReturnValue(createDefaultAppContext({ handleLogout }));
    const user = userEvent.setup();
    render(<Header />);
    const logoutBtn = document.querySelector('header .lucide-log-out')?.closest('button') as HTMLElement;
    await user.click(logoutBtn);
    expect(handleLogout).toHaveBeenCalled();
  });

  // --- Mobile nav hidden on desktop ---
  it('renders nav with hidden class on mobile (md:flex but base-hidden pattern)', () => {
    render(<Header />);
    const nav = document.querySelector('header nav') as HTMLElement;
    // The nav has "hidden md:flex" which means hidden on mobile, flex on desktop
    expect(nav.className).toContain('hidden');
    expect(nav.className).toContain('md:flex');
  });

  it('Header text-based breadcrumb shows correct info for release pages', () => {
    mockUsePathname.mockReturnValue('/release/production/myapp');
    render(<Header />);
    // Should show the namespace "production" and release name "myapp"
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('myapp')).toBeInTheDocument();
  });

  it('Header breadcrumb shows "Chart Store Catalog" on /charts', () => {
    mockUsePathname.mockReturnValue('/charts');
    render(<Header />);
    expect(screen.getByText('Chart Store Catalog')).toBeInTheDocument();
  });

  it('Header breadcrumb shows "Live Events" on /events', () => {
    mockUsePathname.mockReturnValue('/events');
    render(<Header />);
    expect(screen.getByText('Live Events')).toBeInTheDocument();
  });

  it('Header breadcrumb shows "Cluster Health" on /health', () => {
    mockUsePathname.mockReturnValue('/health');
    render(<Header />);
    expect(screen.getByText('Cluster Health')).toBeInTheDocument();
  });

  it('Header breadcrumb shows "Search Results" on /search', () => {
    mockUsePathname.mockReturnValue('/search');
    render(<Header />);
    expect(screen.getByText('Search Results')).toBeInTheDocument();
  });

  it('Header breadcrumb shows "All Namespaces" when selectedNamespace is all', () => {
    mockUsePathname.mockReturnValue('/');
    mockUseApp.mockReturnValue(createDefaultAppContext({ selectedNamespace: 'all' }));
    render(<Header />);
    expect(screen.getByText('All Namespaces')).toBeInTheDocument();
  });

  it('Header breadcrumb shows specific namespace when selected', () => {
    mockUsePathname.mockReturnValue('/');
    mockUseApp.mockReturnValue(createDefaultAppContext({ selectedNamespace: 'staging' }));
    render(<Header />);
    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(screen.getByText('Namespace:')).toBeInTheDocument();
  });
});
