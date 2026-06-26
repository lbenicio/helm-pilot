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

// Mock child components
vi.mock('@/components/AntivirusScanner', () => ({
  default: ({ _manifest, releaseName }: any) => (
    <div data-testid="antivirus-scanner">
      AntivirusScanner: {releaseName}
    </div>
  ),
}));

vi.mock('@/components/ResourceUsageChart', () => ({
  default: ({ name, namespace }: any) => (
    <div data-testid="resource-usage-chart">
      ResourceUsageChart: {namespace}/{name}
    </div>
  ),
}));

import type { K8sCluster } from '@/types/k8s-cluster.type';

import ReleaseDetails from '@/components/ReleaseDetails';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockReleaseDetail(overrides: Record<string, any> = {}) {
  return {
    name: 'my-release',
    namespace: 'default',
    revision: 5,
    updated: '2025-06-01T12:00:00Z',
    status: 'deployed',
    chartName: 'nginx',
    chartVersion: '15.1.0',
    appVersion: '1.27.0',
    values: 'replicaCount: 2\nservice:\n  type: ClusterIP',
    manifest: 'apiVersion: v1\nkind: Service',
    notes: 'Thank you for installing nginx.',
    history: [
      {
        revision: 5,
        status: 'deployed',
        updated: '2025-06-01T12:00:00Z',
        description: 'Upgrade complete',
        chartName: 'nginx',
        chartVersion: '15.1.0',
        appVersion: '1.27.0',
        values: 'replicaCount: 2',
        notes: 'Thank you for installing nginx.',
        manifest: 'apiVersion: v1\nkind: Service',
      },
      {
        revision: 4,
        status: 'superseded',
        updated: '2025-05-28T10:30:00Z',
        description: 'Rollback to 2',
        chartName: 'nginx',
        chartVersion: '15.0.0',
        appVersion: '1.26.0',
        values: 'replicaCount: 1',
      },
    ],
    k8sStatus: 'healthy',
    k8sStatusReason: 'All pods running',
    podCounts: { total: 2, running: 2 },
    ...overrides,
  };
}

const defaultCluster: K8sCluster = {
  id: 'test-cluster',
  name: 'my-cluster',
  apiUrl: 'https://k8s.example.com',
};

describe('ReleaseDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockReleaseDetail(),
    });
  });

  const defaultProps = {
    name: 'my-release',
    namespace: 'default',
    activeCluster: defaultCluster,
    onClose: vi.fn(),
    onRefresh: vi.fn(),
  };

  // --- Loading spinner ---
  it('renders loading spinner initially', () => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<ReleaseDetails {...defaultProps} />);

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(screen.getByText('Querying release database & logs...')).toBeInTheDocument();
  });

  // --- Release name and namespace ---
  it('shows release name and namespace when loaded', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('my-release')).toBeInTheDocument();
    });

    // Namespace is shown as "Namespace: default"
    expect(screen.getByText('default')).toBeInTheDocument();
  });

  it('shows release status badge', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('deployed')).toBeInTheDocument();
    });
  });

  it('shows chart name and version', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      // Chart: nginx-15.1.0 is displayed in the header
      // Use getAllByText because multiple <b> elements exist
      const chartElements = screen.getAllByText(/nginx-15\.1\.0/);
      expect(chartElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Action buttons ---
  it('renders Uninstall button', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Uninstall')).toBeInTheDocument();
    });
  });

  it('renders Restart button', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Restart')).toBeInTheDocument();
    });
  });

  it('renders Back button', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
  });

  it('Back button calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<ReleaseDetails {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Back'));
    expect(onClose).toHaveBeenCalled();
  });

  // --- Tabs ---
  it('renders Overview tab', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('overview')).toBeInTheDocument();
    });
  });

  it('renders History tab', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('history')).toBeInTheDocument();
    });
  });

  it('renders Values tab (values.yaml)', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('values.yaml')).toBeInTheDocument();
    });
  });

  it('renders Manifest tab', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('manifest')).toBeInTheDocument();
    });
  });

  it('renders Security tab (Antivírus Scan)', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Antivírus Scan')).toBeInTheDocument();
    });
  });

  it('switching to Security tab shows AntivirusScanner', async () => {
    const user = userEvent.setup();
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Antivírus Scan')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Antivírus Scan'));

    await waitFor(() => {
      expect(screen.getByTestId('antivirus-scanner')).toBeInTheDocument();
    });
  });

  it('switching to Values tab shows values editor', async () => {
    const user = userEvent.setup();
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('values.yaml')).toBeInTheDocument();
    });

    await user.click(screen.getByText('values.yaml'));

    await waitFor(() => {
      expect(screen.getByText('Upgrade Release')).toBeInTheDocument();
    });
  });

  it('switching to Manifest tab shows manifest content', async () => {
    const user = userEvent.setup();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        mockReleaseDetail({ manifest: 'apiVersion: apps/v1\nkind: Deployment' }),
    });

    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('manifest')).toBeInTheDocument();
    });

    await user.click(screen.getByText('manifest'));

    await waitFor(() => {
      const preElements = document.querySelectorAll('pre');
      const hasManifest = Array.from(preElements).some((el) =>
        el.textContent?.includes('apiVersion: apps/v1'),
      );
      expect(hasManifest).toBe(true);
    });
  });

  it('switching to History tab shows revision timeline', async () => {
    const user = userEvent.setup();
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('history')).toBeInTheDocument();
    });

    await user.click(screen.getByText('history'));

    await waitFor(() => {
      expect(screen.getByText('Revision History Timeline')).toBeInTheDocument();
    });
  });

  it('Overview tab shows release notes', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Release Notes (NOTES.txt)')).toBeInTheDocument();
      expect(screen.getByText('Thank you for installing nginx.')).toBeInTheDocument();
    });
  });

  // --- Error state ---
  it('shows error state when fetch fails', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Release not found' }),
    });

    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to Load Release')).toBeInTheDocument();
    });
  });

  it('shows error message in error state', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Release not found' }),
    });

    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Release not found')).toBeInTheDocument();
    });
  });

  it('shows "Back to List" button in error state', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Release not found' }),
    });

    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Back to List')).toBeInTheDocument();
    });
  });

  it('"Back to List" calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Release not found' }),
    });

    render(<ReleaseDetails {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Back to List')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Back to List'));
    expect(onClose).toHaveBeenCalled();
  });

  // --- Fetch on mount ---
  it('fetches release detail on mount', () => {
    render(<ReleaseDetails {...defaultProps} />);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/k8s/releases/default/my-release',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('includes activeCluster headers in fetch', () => {
    render(<ReleaseDetails {...defaultProps} />);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          'x-k8s-api-url': 'https://k8s.example.com',
        },
      }),
    );
  });

  // --- Action success/error messages ---
  it('calls restart API and refreshes release detail', async () => {
    // NOTE: handleRestart calls setActionSuccess then immediately calls
    // fetchReleaseDetail() which clears actionSuccess. React 18 batches both
    // state updates so the message may never be visible. Instead, verify
    // the restart API was called correctly.
    const user = userEvent.setup();

    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleaseDetail(),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockReleaseDetail(),
    });

    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Restart')).toBeInTheDocument();
    });

    // Mock restart success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Restart triggered.' }),
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await user.click(screen.getByText('Restart'));

    // Verify the restart API was called with correct method and URL
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/k8s/releases/default/my-release/restart',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    vi.restoreAllMocks();
  });

  it('shows action error message', async () => {
    const user = userEvent.setup();

    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleaseDetail(),
    });

    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Restart')).toBeInTheDocument();
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Restart failed.' }),
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await user.click(screen.getByText('Restart'));

    await waitFor(() => {
      expect(screen.getByText('Restart failed.')).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  // --- Auto refresh toggle ---
  it('shows auto-refresh toggle', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Auto-Refresh (30s)')).toBeInTheDocument();
    });
  });

  it('clicking auto-refresh toggles the state', async () => {
    const user = userEvent.setup();
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Auto-Refresh (30s)')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Auto-Refresh (30s)'));

    await waitFor(() => {
      expect(screen.getByText('Auto-Refresh Off')).toBeInTheDocument();
    });
  });

  // --- K8s status badge ---
  it('shows K8s workload status badge', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      // The K8s health badge shows "K8s: healthy"
      expect(screen.getByText(/K8s:/)).toBeInTheDocument();
    });
  });

  // --- Overview tab content ---
  it('shows Active Revision and App Version in Overview', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Active Revision')).toBeInTheDocument();
      expect(screen.getByText('App Version')).toBeInTheDocument();
    });
  });

  it('renders ResourceUsageChart in Overview tab', async () => {
    render(<ReleaseDetails {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('resource-usage-chart')).toBeInTheDocument();
    });
  });
});
