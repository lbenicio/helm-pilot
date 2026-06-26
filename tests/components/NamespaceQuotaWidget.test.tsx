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

import NamespaceQuotaWidget from '@/components/NamespaceQuotaWidget';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockQuotaData(overrides: Record<string, any> = {}) {
  return {
    quotas: [
      { name: 'CPU', resource: 'requests.cpu', limit: 4000, used: 1500, unit: 'm', percentage: 38 },
      { name: 'Memory', resource: 'requests.memory', limit: 8192, used: 6000, unit: 'Mi', percentage: 73 },
      { name: 'Pods', resource: 'pods', limit: 20, used: 18, unit: '', percentage: 90 },
      { name: 'Services', resource: 'services', limit: 10, used: 3, unit: '', percentage: 30 },
    ],
    ...overrides,
  };
}

const defaultCluster: K8sCluster = {
  id: 'test-cluster',
  name: 'my-cluster',
  apiUrl: 'https://k8s.example.com',
};

describe('NamespaceQuotaWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockQuotaData(),
    });
  });

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  it('shows loading state while fetching quota data', () => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    // The header title is always shown
    expect(screen.getByText('Namespace Quota Limits')).toBeInTheDocument();

    // After fetchQuotas is called, isRefreshing becomes true,
    // which hides the skeleton (loading && !isRefreshing).
    // Instead, verify no quota items render while loading, and the
    // refresh button has the spin animation.
    expect(screen.queryByText('CPU')).not.toBeInTheDocument();

    // The refresh button should be disabled
    const refreshBtn = screen.getByTitle('Refresh Quota Metrics');
    expect(refreshBtn).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // Successful data rendering
  // ---------------------------------------------------------------------------
  it('renders namespace quota bars when data is loaded', async () => {
    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('CPU')).toBeInTheDocument();
      expect(screen.getByText('Memory')).toBeInTheDocument();
      expect(screen.getByText('Pods')).toBeInTheDocument();
      expect(screen.getByText('Services')).toBeInTheDocument();
    });
  });

  it('renders quota items with used/limit values', async () => {
    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      // CPU: 1500 >= 1000 → "1.5 Cores" used, 4000 >= 1000 → "4.0 Cores" limit
      expect(screen.getByText('1.5 Cores')).toBeInTheDocument();
      expect(screen.getByText('4.0 Cores')).toBeInTheDocument();
      // Memory: 6000 >= 1024 → "5.9 GiB" used (6000/1024 = 5.859...), 8192 >= 1024 → "8.0 GiB" limit
      expect(screen.getByText('5.9 GiB')).toBeInTheDocument();
      expect(screen.getByText('8.0 GiB')).toBeInTheDocument();
      // Pods: 18 used, 20 limit (plain numbers)
      expect(screen.getByText('18')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
    });
  });

  it('renders percentage values for each quota item', async () => {
    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('38% used')).toBeInTheDocument();
      expect(screen.getByText('73% used')).toBeInTheDocument();
      expect(screen.getByText('90% used')).toBeInTheDocument();
      expect(screen.getByText('30% used')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Color coding
  // ---------------------------------------------------------------------------
  it('applies green/emerald color class for quotas below 50%', async () => {
    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      // CPU is 38% -> emerald (green)
      const cpuPercentage = screen.getByText('38% used');
      expect(cpuPercentage.className).toContain('emerald');

      // Services is 30% -> emerald (green)
      const svcPercentage = screen.getByText('30% used');
      expect(svcPercentage.className).toContain('emerald');
    });
  });

  it('applies amber color class for quotas between 50% and 80%', async () => {
    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      // Memory is 73% -> amber
      const memPercentage = screen.getByText('73% used');
      expect(memPercentage.className).toContain('amber');
    });
  });

  it('applies rose/red color class for quotas above 80%', async () => {
    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      // Pods is 90% -> rose (red)
      const podsPercentage = screen.getByText('90% used');
      expect(podsPercentage.className).toContain('rose');
    });
  });

  it('renders progress bars with correct color backgrounds', async () => {
    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      // Check that progress bar containers exist with bg classes
      const emeraldBgs = document.querySelectorAll('[class*="bg-emerald-500/10"]');
      expect(emeraldBgs.length).toBeGreaterThanOrEqual(1);

      const amberBgs = document.querySelectorAll('[class*="bg-amber-500/10"]');
      expect(amberBgs.length).toBeGreaterThanOrEqual(1);

      const roseBgs = document.querySelectorAll('[class*="bg-rose-500/10"]');
      expect(roseBgs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Resource icons
  // ---------------------------------------------------------------------------
  it('renders resource-specific icons (CPU, Memory, Pods, Services)', async () => {
    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      // Check that the SVG icons rendered (lucide-react Cpu, HardDrive, Layers, Radio)
      const svgElements = document.querySelectorAll('svg');
      // Each quota item gets an icon, so we should have at least 4
      expect(svgElements.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  it('shows error state when fetch fails (non-ok response)', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Cluster unreachable' }),
    });

    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Could not fetch quotas')).toBeInTheDocument();
      expect(screen.getByText('Cluster unreachable')).toBeInTheDocument();
    });
  });

  it('shows error state for network failures', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Could not fetch quotas')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows default error message when API returns no error text', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Could not fetch quotas')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to load namespace resource quotas.'),
      ).toBeInTheDocument();
    });
  });

  it('shows Retry Connection button in error state', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Retry Connection')).toBeInTheDocument();
    });
  });

  it('retries fetch when Retry Connection button is clicked', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuotaData(),
    });

    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Retry Connection')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Retry Connection'));

    await waitFor(() => {
      expect(screen.getByText('CPU')).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Refresh button
  // ---------------------------------------------------------------------------
  it('renders a refresh button', async () => {
    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('CPU')).toBeInTheDocument();
    });

    const refreshBtn = screen.getByTitle('Refresh Quota Metrics');
    expect(refreshBtn).toBeInTheDocument();
  });

  it('triggers fetch when refresh button is clicked', async () => {
    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    // Wait for data and for isRefreshing to clear (setTimeout of 500ms)
    await waitFor(() => {
      expect(screen.getByText('CPU')).toBeInTheDocument();
    });

    // Wait for refresh button to become enabled (isRefreshing resets after 500ms)
    await waitFor(() => {
      const refreshBtn = screen.getByTitle('Refresh Quota Metrics');
      expect(refreshBtn).not.toBeDisabled();
    });

    const initialCallCount = mockFetch.mock.calls.length;

    const refreshBtn = screen.getByTitle('Refresh Quota Metrics');
    await userEvent.click(refreshBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(initialCallCount + 1);
    });
  });

  it('refresh button is disabled while loading', () => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    const refreshBtn = screen.getByTitle('Refresh Quota Metrics');
    expect(refreshBtn).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // Namespace handling
  // ---------------------------------------------------------------------------
  it('fetches quotas for the given namespace', async () => {
    render(<NamespaceQuotaWidget namespace="production" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/k8s/namespaces/production/quota', expect.any(Object));
    });
  });

  it('fetches quotas for "all" when namespace is empty string', async () => {
    render(<NamespaceQuotaWidget namespace="" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/k8s/namespaces/all/quota', expect.any(Object));
    });
  });

  it('displays "all namespaces" subtitle when namespace is empty', async () => {
    render(<NamespaceQuotaWidget namespace="" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('all namespaces')).toBeInTheDocument();
    });
  });

  it('displays the namespace name in the subtitle', async () => {
    render(<NamespaceQuotaWidget namespace="staging" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('staging')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Cluster headers
  // ---------------------------------------------------------------------------
  it('sends cluster-specific headers when activeCluster is provided', async () => {
    const clusterWithAuth: K8sCluster = {
      id: 'auth-cluster',
      name: 'secure-cluster',
      apiUrl: 'https://secure.k8s.example.com',
      token: 'bearer-token-123',
      caCert: 'base64-encoded-cert-data',
    };

    render(<NamespaceQuotaWidget namespace="default" activeCluster={clusterWithAuth} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers).toBeDefined();
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['x-k8s-api-url']).toBe('https://secure.k8s.example.com');
      expect(options.headers['x-k8s-token']).toBe('bearer-token-123');
      expect(options.headers['x-k8s-ca-cert']).toBe('base64-encoded-cert-data');
    });
  });

  it('does not send optional cluster headers when they are undefined', async () => {
    const minimalCluster: K8sCluster = {
      id: 'minimal-cluster',
      name: 'minimal',
      apiUrl: 'https://k8s.example.com',
    };

    render(<NamespaceQuotaWidget namespace="default" activeCluster={minimalCluster} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers).toBeDefined();
      expect(options.headers['x-k8s-api-url']).toBe('https://k8s.example.com');
      expect(options.headers['x-k8s-token']).toBeUndefined();
      expect(options.headers['x-k8s-ca-cert']).toBeUndefined();
    });
  });

  it('does not send cluster headers when activeCluster is null', async () => {
    render(<NamespaceQuotaWidget namespace="default" activeCluster={null} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers).toBeDefined();
      expect(options.headers['x-k8s-api-url']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Empty quotas
  // ---------------------------------------------------------------------------
  it('renders no quota items when API returns empty quotas array', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ quotas: [] }),
    });

    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      // The footer info text should still appear
      expect(screen.getByText(/Quotas set CPU, memory/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Footer info
  // ---------------------------------------------------------------------------
  it('renders the informational footer about quota limits', async () => {
    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText(/Quotas set CPU, memory/)).toBeInTheDocument();
      expect(screen.getByText(/Green means well within limits/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Re-fetches when namespace or activeCluster change
  // ---------------------------------------------------------------------------
  it('re-fetches when namespace prop changes', async () => {
    const { rerender } = render(
      <NamespaceQuotaWidget namespace="ns1" activeCluster={defaultCluster} />,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    rerender(<NamespaceQuotaWidget namespace="ns2" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith('/api/k8s/namespaces/ns2/quota', expect.any(Object));
    });
  });

  it('re-fetches when activeCluster prop changes', async () => {
    const { rerender } = render(
      <NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const newCluster: K8sCluster = {
      id: 'cluster-2',
      name: 'second-cluster',
      apiUrl: 'https://k8s-2.example.com',
    };

    rerender(<NamespaceQuotaWidget namespace="default" activeCluster={newCluster} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Resource formatting edge cases
  // ---------------------------------------------------------------------------
  it('formats CPU values >= 1000 as Cores', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        quotas: [
          { name: 'CPU', resource: 'requests.cpu', limit: 2000, used: 1000, unit: 'm', percentage: 50 },
        ],
      }),
    });

    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('1.0 Cores')).toBeInTheDocument();
      expect(screen.getByText('2.0 Cores')).toBeInTheDocument();
    });
  });

  it('formats CPU values < 1000 as millicpu', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        quotas: [
          { name: 'CPU', resource: 'requests.cpu', limit: 500, used: 250, unit: 'm', percentage: 50 },
        ],
      }),
    });

    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('250m CPU')).toBeInTheDocument();
      expect(screen.getByText('500m CPU')).toBeInTheDocument();
    });
  });

  it('formats memory values >= 1024 as GiB', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        quotas: [
          { name: 'Memory', resource: 'requests.memory', limit: 4096, used: 2048, unit: 'Mi', percentage: 50 },
        ],
      }),
    });

    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('2.0 GiB')).toBeInTheDocument();
      expect(screen.getByText('4.0 GiB')).toBeInTheDocument();
    });
  });

  it('formats memory values < 1024 as MiB', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        quotas: [
          { name: 'Memory', resource: 'requests.memory', limit: 512, used: 256, unit: 'Mi', percentage: 50 },
        ],
      }),
    });

    render(<NamespaceQuotaWidget namespace="default" activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('256 MiB')).toBeInTheDocument();
      expect(screen.getByText('512 MiB')).toBeInTheDocument();
    });
  });
});
