import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    div: 'div',
    tr: 'tr',
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock AppContext
vi.mock('@/contexts/AppContext', () => ({
  useApp: vi.fn(),
}));

import type { K8sCluster } from '@/types/k8s-cluster.type';

import EventsPage from '@/app/events/page';
import { useApp } from '@/contexts/AppContext';

const mockUseApp = vi.mocked(useApp);

function createAppContext(overrides: Partial<ReturnType<typeof useApp>> = {}) {
  return {
    session: { authenticated: true, email: 'test@example.com', name: 'Test User' },
    loadingSession: false,
    checkSession: vi.fn(),
    handleLogout: vi.fn(),
    clusters: [],
    activeCluster: null as K8sCluster | null,
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

function mockEvents(overrides: any[] = []) {
  return [
    {
      id: 'evt-1',
      timestamp: '2025-06-15T10:30:00Z',
      type: 'helm',
      severity: 'success',
      category: 'install',
      message: 'Successfully installed nginx',
      user: 'admin',
    },
    {
      id: 'evt-2',
      timestamp: '2025-06-15T10:31:00Z',
      type: 'k8s',
      severity: 'warning',
      category: 'resource',
      message: 'Pod cpu-nginx-abc is using 85% of CPU limit',
      user: undefined,
    },
    {
      id: 'evt-3',
      timestamp: '2025-06-15T10:32:00Z',
      type: 'k8s',
      severity: 'error',
      category: 'health',
      message: 'Liveness probe failed for redis-master-0',
      user: 'system',
    },
    ...overrides,
  ];
}

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('EventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApp.mockReturnValue(createAppContext());
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockEvents(),
    });
  });

  // --- Loading state ---
  it('renders loading state initially', async () => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Loading events...')).toBeInTheDocument();
    });
  });

  // --- Events rendered after successful fetch ---
  it('renders events after successful fetch', async () => {
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Successfully installed nginx')).toBeInTheDocument();
    });

    expect(screen.getByText('Pod cpu-nginx-abc is using 85% of CPU limit')).toBeInTheDocument();
    expect(screen.getByText('Liveness probe failed for redis-master-0')).toBeInTheDocument();
  });

  it('renders severity and type labels for all events', async () => {
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Successfully installed nginx')).toBeInTheDocument();
    });

    const typeSpans = document.querySelectorAll('[class*="w-12"]');
    const types = Array.from(typeSpans).map((s) => s.textContent);
    expect(types.some((t) => t === 'helm')).toBe(true);
    expect(types.some((t) => t === 'k8s')).toBe(true);

    const severitySpans = document.querySelectorAll('[class*="w-16"]');
    const severities = Array.from(severitySpans).map((s) => s.textContent);
    expect(severities.some((s) => s === 'success')).toBe(true);
    expect(severities.some((s) => s === 'warning')).toBe(true);
    expect(severities.some((s) => s === 'error')).toBe(true);
  });

  it('renders the Live Event Stream heading', async () => {
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Live Event Stream')).toBeInTheDocument();
    });
  });

  // --- Error state ---
  it('renders error state when fetch fails with JSON error', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Kubernetes API unavailable' }),
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Kubernetes API unavailable')).toBeInTheDocument();
    });
  });

  it('renders error state when fetch throws', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error('Network failure'));

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });
  });

  it('renders Retry button in error state', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Something went wrong' }),
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('clicking Retry re-fetches events', async () => {
    const user = userEvent.setup();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Something went wrong' }),
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    const initialCalls = mockFetch.mock.calls.length;
    await user.click(screen.getByText('Retry'));
    expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  // --- Empty state ---
  it('renders "No events found" when events array is empty', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('No events found')).toBeInTheDocument();
    });
  });

  // --- Count badges ---
  it('displays count badges with correct values', async () => {
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Successfully installed nginx')).toBeInTheDocument();
    });

    // 1 error, 1 warning, 1 success -> all show "1"
    const counts = screen.getAllByText('1');
    expect(counts.length).toBeGreaterThanOrEqual(3);
  });

  it('shows zero counts when no events match severity', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{
        id: 'evt-1',
        timestamp: '2025-06-15T10:30:00Z',
        type: 'helm',
        severity: 'info',
        category: 'test',
        message: 'Info message',
      }],
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Info message')).toBeInTheDocument();
    });

    const zeroCounts = screen.getAllByText('0');
    expect(zeroCounts.length).toBe(3);
  });

  // --- Auto-refresh toggle ---
  it('toggles auto-refresh button', async () => {
    const user = userEvent.setup();

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Successfully installed nginx')).toBeInTheDocument();
    });

    // When autoRefresh is true, the toggle button has bg-blue-50 class
    const autoRefreshBtn = document.querySelector('.bg-blue-50');
    expect(autoRefreshBtn).toBeInTheDocument();

    await user.click(autoRefreshBtn!);

    // After clicking, auto-refresh is off: button should have bg-white
    await waitFor(() => {
      const offBtn = document.querySelector('.bg-white.dark\\:bg-slate-900');
      expect(offBtn).toBeInTheDocument();
    });
  });

  // --- Manual refresh ---
  it('manual refresh button triggers fetch', async () => {
    const user = userEvent.setup();

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Successfully installed nginx')).toBeInTheDocument();
    });

    const initialCalls = mockFetch.mock.calls.length;

    // Get all buttons; the last one is the manual refresh button
    const allButtons = screen.getAllByRole('button');
    const refreshBtn = allButtons[allButtons.length - 1];

    await user.click(refreshBtn);
    expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  // --- ActiveCluster headers ---
  it('uses activeCluster headers in fetch request', () => {
    const cluster: K8sCluster = {
      id: 'test-cluster',
      name: 'my-cluster',
      apiUrl: 'https://k8s.example.com',
      token: 'my-token',
      caCert: 'my-ca-cert',
    };

    mockUseApp.mockReturnValue(createAppContext({ activeCluster: cluster }));

    render(<EventsPage />);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/k8s/activity',
      expect.objectContaining({
        headers: {
          'x-k8s-api-url': 'https://k8s.example.com',
          'x-k8s-token': 'my-token',
          'x-k8s-ca-cert': 'my-ca-cert',
        },
      }),
    );
  });

  it('sends empty headers when no active cluster', () => {
    mockUseApp.mockReturnValue(createAppContext({ activeCluster: null }));

    render(<EventsPage />);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/k8s/activity',
      expect.objectContaining({ headers: {} }),
    );
  });
});
