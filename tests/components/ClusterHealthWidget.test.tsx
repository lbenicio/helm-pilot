import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock motion/react to avoid animation-related issues in tests
vi.mock('motion/react', () => ({
  motion: {
    div: 'div',
    span: 'span',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import type { K8sCluster } from '@/types/k8s-cluster.type';

import ClusterHealthWidget from '@/components/ClusterHealthWidget';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockClusterHealthData(overrides: Record<string, any> = {}) {
  return {
    success: true,
    clusterName: 'test-cluster',
    latencyMs: 42,
    nodes: {
      total: 3,
      ready: 3,
      notReady: 0,
      cpuUsagePercent: 35,
      memoryUsagePercent: 60,
      list: [
        {
          name: 'node-1',
          status: 'Ready',
          role: 'control-plane',
          cpu: '4',
          memory: '16Gi',
        },
        {
          name: 'node-2',
          status: 'Ready',
          role: 'worker',
          cpu: '8',
          memory: '32Gi',
        },
        {
          name: 'node-3',
          status: 'Ready',
          role: 'worker',
          cpu: '8',
          memory: '32Gi',
        },
      ],
    },
    components: {
      controllerManager: 'Healthy',
      scheduler: 'Healthy',
      etcd: 'Healthy',
    },
    polledAt: '2025-06-01T12:00:00Z',
    ...overrides,
  };
}

const defaultCluster: K8sCluster = {
  id: 'test-cluster',
  name: 'my-cluster',
  apiUrl: 'https://k8s.example.com',
};

describe('ClusterHealthWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockClusterHealthData(),
    });
  });

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  it('shows loading skeleton placeholders initially while fetching health data', () => {
    // Keep the fetch promise pending so loading stays true
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    // The header title is always shown
    expect(
      screen.getByText('Control Plane & Cluster Metrics'),
    ).toBeInTheDocument();

    // Skeleton placeholders inside the node health card (animate-pulse wrappers)
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Successful data rendering
  // ---------------------------------------------------------------------------
  it('renders node health ready/total count when data is fetched', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('3/3')).toBeInTheDocument();
      expect(screen.getByText('Nodes Ready')).toBeInTheDocument();
    });
  });

  it('displays the "Stable" badge in the node health card', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Stable')).toBeInTheDocument();
    });
  });

  it('renders latency value in milliseconds', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
      // The "ms" unit label appears next to the number
      expect(screen.getByText('ms')).toBeInTheDocument();
    });
  });

  it('shows "Excellent connection" text when latency is below 50ms', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Excellent connection')).toBeInTheDocument();
    });
  });

  it('shows "Slight network congestion" text when latency is 50ms or above', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockClusterHealthData({ latencyMs: 120 }),
    });

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Slight network congestion')).toBeInTheDocument();
    });
  });

  it('displays component statuses: Controller, Scheduler, and etcd', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      // The component labels
      expect(screen.getByText('Controller')).toBeInTheDocument();
      expect(screen.getByText('Scheduler')).toBeInTheDocument();
      expect(screen.getByText('etcd database')).toBeInTheDocument();

      // Each component shows its status value
      const healthyTexts = screen.getAllByText('Healthy');
      expect(healthyTexts.length).toBe(3); // controller, scheduler, etcd
    });
  });

  it('shows Unhealthy status for components when API returns Unhealthy', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        mockClusterHealthData({
          components: {
            controllerManager: 'Unhealthy',
            scheduler: 'Healthy',
            etcd: 'Unhealthy',
          },
        }),
    });

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      const unhealthyTexts = screen.getAllByText('Unhealthy');
      expect(unhealthyTexts.length).toBe(2); // controller + etcd
      expect(screen.getByText('Healthy')).toBeInTheDocument(); // scheduler still healthy
    });
  });

  it('renders warning message when some nodes are NotReady', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        mockClusterHealthData({
          nodes: {
            total: 5,
            ready: 3,
            notReady: 2,
            cpuUsagePercent: 35,
            memoryUsagePercent: 60,
            list: [],
          },
        }),
    });

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(
        screen.getByText('2 node(s) unhealthy or not responding'),
      ).toBeInTheDocument();
      expect(screen.getByText('3/5')).toBeInTheDocument();
    });
  });

  it('shows healthy-all-nodes message when no nodes are NotReady', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'All provisioned nodes are healthy and executing scheduled tasks',
        ),
      ).toBeInTheDocument();
    });
  });

  it('renders the footer with polled-at timestamp', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText(/Last Polled:/)).toBeInTheDocument();
      expect(screen.getByText(/Next Poll in/)).toBeInTheDocument();
    });
  });

  it('shows "Next Poll in manual click" footer text when autoRefresh is off', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    // Turn off auto-refresh by clicking the toggle
    const toggle = document.querySelector('input[type="checkbox"]');
    expect(toggle).toBeInTheDocument();
    if (toggle) {
      await userEvent.click(toggle);
    }

    await waitFor(() => {
      expect(screen.getByText('Next Poll in manual click')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  it('shows error state with AlertCircle icon and failure message when fetch fails', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
      json: async () => ({ success: false, error: 'Cluster unreachable' }),
    });

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to connect to Kubernetes'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to retrieve cluster metrics/),
      ).toBeInTheDocument();
    });
  });

  it('shows error state when API returns success: false', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        error: 'API key expired',
      }),
    });

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to connect to Kubernetes'),
      ).toBeInTheDocument();
      expect(screen.getByText('API key expired')).toBeInTheDocument();
    });
  });

  it('shows Retry Connection button in error state', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    });

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Retry Connection')).toBeInTheDocument();
    });
  });

  it('retries fetch when Retry Connection button is clicked', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Gateway Timeout',
      json: async () => ({}),
    });
    // On retry, succeed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockClusterHealthData(),
    });

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Retry Connection')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Retry Connection'));

    await waitFor(() => {
      // Data should now be rendered
      expect(screen.getByText('3/3')).toBeInTheDocument();
      // fetch should have been called twice
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it('shows error state for network failures', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to connect to Kubernetes'),
      ).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows default error message when API returns no error text', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error(''));

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to connect to Kubernetes'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Failed to connect to cluster API'),
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-refresh toggle
  // ---------------------------------------------------------------------------
  it('renders auto-refresh toggle with "Live Polling" label by default', () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    expect(screen.getByText('Live Polling')).toBeInTheDocument();
  });

  it('switches auto-refresh label to "Manual" when toggled off', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    const toggle = document.querySelector('input[type="checkbox"]');
    expect(toggle).toBeInTheDocument();
    if (toggle) {
      await userEvent.click(toggle);
    }

    await waitFor(() => {
      expect(screen.getByText('Manual')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Refresh button
  // ---------------------------------------------------------------------------
  it('renders a refresh button that triggers a fetch', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('3/3')).toBeInTheDocument();
    });

    const initialCallCount = mockFetch.mock.calls.length;

    // Click the refresh button
    const refreshBtn = screen.getByText('Refresh');
    await userEvent.click(refreshBtn);

    // Should have been called one additional time
    expect(mockFetch).toHaveBeenCalledTimes(initialCallCount + 1);
  });

  it('refresh button is disabled while loading', () => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    const refreshBtn = screen.getByText('Refresh').closest('button');
    expect(refreshBtn).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // Cluster header passthrough
  // ---------------------------------------------------------------------------
  it('sends cluster-specific headers when activeCluster is provided', async () => {
    const clusterWithAuth: K8sCluster = {
      id: 'auth-cluster',
      name: 'secure-cluster',
      apiUrl: 'https://secure.example.com',
      token: 'bearer-token-xyz',
      caCert: 'ca-cert-data',
    };

    render(<ClusterHealthWidget activeCluster={clusterWithAuth} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/k8s/cluster-health', {
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-k8s-api-url': 'https://secure.example.com',
          'x-k8s-token': 'bearer-token-xyz',
          'x-k8s-ca-cert': 'ca-cert-data',
          'x-k8s-cluster-name': 'secure-cluster',
        }),
      });
    });
  });

  it('does not send cluster headers when activeCluster is null', async () => {
    render(<ClusterHealthWidget activeCluster={null} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/k8s/cluster-health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  it('does not send optional token/caCert headers when they are undefined', async () => {
    const clusterMinimal: K8sCluster = {
      id: 'minimal',
      name: 'minimal-cluster',
      apiUrl: 'https://minimal.example.com',
    };

    render(<ClusterHealthWidget activeCluster={clusterMinimal} />);

    await waitFor(() => {
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['x-k8s-api-url']).toBe('https://minimal.example.com');
      expect(headers['x-k8s-token']).toBeUndefined();
      expect(headers['x-k8s-ca-cert']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Node inspector accordion
  // ---------------------------------------------------------------------------
  it('renders the node hardware specifications accordion header', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Node Hardware Specifications/),
      ).toBeInTheDocument();
    });
  });

  it('shows node count in the accordion header', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      // The accordion header contains the list length: "(3)"
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });
  });

  it('expands the accordion to show node details table when clicked', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Expand Node details')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Expand Node details'));

    // Now we should see the node table
    await waitFor(() => {
      expect(screen.getByText('Collapse')).toBeInTheDocument();
      expect(screen.getByText('node-1')).toBeInTheDocument();
      expect(screen.getByText('node-2')).toBeInTheDocument();
      expect(screen.getByText('node-3')).toBeInTheDocument();
    });
  });

  it('shows node roles in the expanded table', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Expand Node details')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Expand Node details'));

    await waitFor(() => {
      expect(screen.getByText('control-plane')).toBeInTheDocument();
      // All worker nodes
      const workerBadges = screen.getAllByText('worker');
      expect(workerBadges.length).toBe(2);
    });
  });

  it('shows node status badges (Ready/NotReady) in the table', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        mockClusterHealthData({
          nodes: {
            total: 2,
            ready: 1,
            notReady: 1,
            cpuUsagePercent: 35,
            memoryUsagePercent: 60,
            list: [
              { name: 'good-node', status: 'Ready', role: 'worker', cpu: '4', memory: '16Gi' },
              { name: 'bad-node', status: 'NotReady', role: 'worker', cpu: '4', memory: '16Gi' },
            ],
          },
        }),
    });

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Expand Node details')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Expand Node details'));

    await waitFor(() => {
      const readyBadges = screen.getAllByText('Ready');
      const notReadyBadges = screen.getAllByText('NotReady');
      expect(readyBadges.length).toBeGreaterThanOrEqual(1);
      expect(notReadyBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('collapses the accordion when collapse button is clicked', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Expand Node details')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Expand Node details'));

    await waitFor(() => {
      expect(screen.getByText('Collapse')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Collapse'));

    await waitFor(() => {
      expect(screen.getByText('Expand Node details')).toBeInTheDocument();
      // Node names should no longer be visible
      expect(screen.queryByText('node-1')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Latency color coding
  // ---------------------------------------------------------------------------
  it('applies green/emerald color class for low latency (< 50ms)', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockClusterHealthData({ latencyMs: 25 }),
    });

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      const latencyBadge = screen.getByText('Latency');
      expect(latencyBadge.className).toContain('text-emerald');
    });
  });

  it('applies amber color class for medium latency (50-149ms)', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockClusterHealthData({ latencyMs: 100 }),
    });

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      const latencyBadge = screen.getByText('Latency');
      expect(latencyBadge.className).toContain('text-amber');
    });
  });

  it('applies rose/red color class for high latency (>= 150ms)', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockClusterHealthData({ latencyMs: 200 }),
    });

    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      const latencyBadge = screen.getByText('Latency');
      expect(latencyBadge.className).toContain('text-rose');
    });
  });

  // ---------------------------------------------------------------------------
  // Header displays active cluster name
  // ---------------------------------------------------------------------------
  it('shows active cluster name in the header subtitle', async () => {
    render(<ClusterHealthWidget activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText(/my-cluster/)).toBeInTheDocument();
    });
  });

  it('shows "Active Cluster" fallback when activeCluster is null', async () => {
    render(<ClusterHealthWidget activeCluster={null} />);

    await waitFor(() => {
      expect(screen.getByText(/Active Cluster/)).toBeInTheDocument();
    });
  });
});
