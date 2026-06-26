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

import HealthPage from '@/app/health/page';
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

function mockHealthData(overrides: Record<string, any> = {}) {
  return {
    success: true,
    clusterName: 'test-cluster',
    latencyMs: 42,
    nodes: {
      total: 3,
      ready: 3,
      notReady: 0,
      cpuUsagePercent: 35,
      memoryUsagePercent: 62,
      list: [
        { name: 'node-1', status: 'Ready', role: 'control-plane', cpu: '2.5 / 8', memory: '8Gi / 16Gi' },
        { name: 'node-2', status: 'Ready', role: 'worker', cpu: '1.2 / 8', memory: '4Gi / 16Gi' },
        { name: 'node-3', status: 'NotReady', role: 'worker', cpu: '0 / 8', memory: '0 / 16Gi' },
      ],
    },
    components: {
      controllerManager: 'Healthy',
      scheduler: 'Healthy',
      etcd: 'Healthy',
    },
    polledAt: '2025-06-15T10:30:00.000Z',
    ...overrides,
  };
}

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('HealthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApp.mockReturnValue(createAppContext());
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockHealthData(),
    });
  });

  // --- Loading state ---
  it('renders loading skeleton initially', async () => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    // 3 skeleton placeholder divs
    const skeletonDivs = document.querySelectorAll('.animate-pulse > div');
    expect(skeletonDivs.length).toBe(3);
  });

  // --- Heading ---
  it('renders the Cluster Health heading', async () => {
    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Cluster Health & Diagnostics')).toBeInTheDocument();
    });
  });

  // --- Health data rendered ---
  it('renders node count summary card', async () => {
    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('3/3')).toBeInTheDocument();
    });
    expect(screen.getByText('Ready / Total')).toBeInTheDocument();
  });

  it('renders API latency summary card', async () => {
    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('ms')).toBeInTheDocument();
    });
    expect(screen.getByText('Response time')).toBeInTheDocument();
  });

  it('renders resources summary card', async () => {
    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Cluster Health & Diagnostics')).toBeInTheDocument();
    });

    const cpuEls = screen.getAllByText('CPU');
    expect(cpuEls.length).toBeGreaterThanOrEqual(1);
    const memEls = screen.getAllByText('Memory');
    expect(memEls.length).toBeGreaterThanOrEqual(1);
    const pctSpans = screen.getAllByText(/\d+%/);
    const pcts = pctSpans.map((s) => s.textContent);
    expect(pcts.some((p) => p === '35%')).toBe(true);
    expect(pcts.some((p) => p === '62%')).toBe(true);
  });

  it('renders last polled timestamp', async () => {
    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText(/Last polled:/)).toBeInTheDocument();
    });
  });

  // --- Node inventory table ---
  it('renders node inventory table with node names', async () => {
    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Node Inventory')).toBeInTheDocument();
    });

    expect(screen.getByText('node-1')).toBeInTheDocument();
    expect(screen.getByText('node-2')).toBeInTheDocument();
    expect(screen.getByText('node-3')).toBeInTheDocument();
  });

  it('renders node status badges', async () => {
    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('node-1')).toBeInTheDocument();
    });

    const readyBadges = screen.getAllByText('Ready');
    const notReadyBadges = screen.getAllByText('NotReady');
    expect(readyBadges.length).toBe(2);
    expect(notReadyBadges.length).toBe(1);
  });

  it('renders node roles', async () => {
    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('node-1')).toBeInTheDocument();
    });

    expect(screen.getByText('control-plane')).toBeInTheDocument();
    const workerEls = screen.getAllByText('worker');
    expect(workerEls.length).toBe(2);
  });

  // --- Control plane components ---
  it('renders control plane component statuses', async () => {
    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Control Plane Components')).toBeInTheDocument();
    });

    const healthyEls = screen.getAllByText('Healthy');
    expect(healthyEls.length).toBe(3);
    expect(screen.getByText('Controller')).toBeInTheDocument();
    expect(screen.getByText('Scheduler')).toBeInTheDocument();
  });

  it('renders unhealthy control plane component', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockHealthData({
        components: { controllerManager: 'Unhealthy', scheduler: 'Healthy', etcd: 'Healthy' },
      }),
    });

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Unhealthy')).toBeInTheDocument();
    });
  });

  // --- Error state ---
  it('renders error state when fetch fails with non-ok', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch health data')).toBeInTheDocument();
    });

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('renders error state when fetch throws', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('clicking Retry re-fetches health data', async () => {
    const user = userEvent.setup();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'fail' }),
    });

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    const callsBefore = mockFetch.mock.calls.length;
    await user.click(screen.getByText('Retry'));
    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  // --- Refresh button ---
  it('refresh button triggers re-fetch', async () => {
    const user = userEvent.setup();

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Cluster Health & Diagnostics')).toBeInTheDocument();
    });

    const callsBefore = mockFetch.mock.calls.length;
    const refreshBtn = document.querySelector('button');
    if (refreshBtn) await user.click(refreshBtn);
    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
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

    render(<HealthPage />);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/k8s/cluster-health',
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

    render(<HealthPage />);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/k8s/cluster-health',
      expect.objectContaining({ headers: {} }),
    );
  });

  // --- No nodes state ---
  it('handles zero nodes correctly', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockHealthData({
        nodes: {
          total: 0,
          ready: 0,
          notReady: 0,
          cpuUsagePercent: 0,
          memoryUsagePercent: 0,
          list: [],
        },
      }),
    });

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('0/0')).toBeInTheDocument();
    });
  });
});
