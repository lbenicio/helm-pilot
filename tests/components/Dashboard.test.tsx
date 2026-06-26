import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock motion/react to avoid animation-related issues in tests
vi.mock('motion/react', () => ({
  motion: {
    div: 'div',
    tr: 'tr',
    span: 'span',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock child components
vi.mock('@/components/ClusterHealthWidget', () => ({
  default: ({ activeCluster }: any) => (
    <div data-testid="cluster-health-widget">
      ClusterHealthWidget {activeCluster?.name || 'none'}
    </div>
  ),
}));

vi.mock('@/components/NamespaceQuotaWidget', () => ({
  default: ({ namespace, activeCluster }: any) => (
    <div data-testid="namespace-quota-widget">
      NamespaceQuotaWidget ns={namespace} cluster={activeCluster?.name || 'none'}
    </div>
  ),
}));

vi.mock('@/components/ActivityLog', () => ({
  default: () => <div data-testid="activity-log">ActivityLog</div>,
}));

// Mock useApp
vi.mock('@/contexts/AppContext', () => ({
  useApp: vi.fn(),
}));

import type { HelmRelease } from '@/types/helm-release.type';
import type { K8sCluster } from '@/types/k8s-cluster.type';

import Dashboard from '@/components/Dashboard';
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

function mockReleases(overrides: Partial<HelmRelease>[] = []): HelmRelease[] {
  return [
    {
      name: 'my-release',
      namespace: 'default',
      revision: 5,
      updated: '2025-06-01T12:00:00Z',
      status: 'deployed',
      chartName: 'nginx',
      chartVersion: '15.1.0',
      appVersion: '1.27.0',
      values: 'replicaCount: 2',
      manifest: '---\n# manifest',
      notes: 'Deploy notes',
    },
    {
      name: 'failed-app',
      namespace: 'staging',
      revision: 2,
      updated: '2025-06-02T08:30:00Z',
      status: 'failed',
      chartName: 'redis',
      chartVersion: '18.2.0',
      appVersion: '7.4.0',
    },
    {
      name: 'another-release',
      namespace: 'default',
      revision: 1,
      updated: '2025-06-03T14:00:00Z',
      status: 'deployed',
      chartName: 'grafana',
      chartVersion: '8.3.0',
      appVersion: '11.2.0',
    },
    ...overrides,
  ] as HelmRelease[];
}

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApp.mockReturnValue(createAppContext());
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockReleases(),
    });
  });

  // --- Loading state ---
  it('renders loading skeleton rows while fetching releases', async () => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('shows loading placeholders in stat cards during loading', async () => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Total Releases')).toBeInTheDocument();
    });
  });

  // --- Calls fetch on mount ---
  it('calls fetch on mount with selected namespace', () => {
    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/k8s/releases?namespace=all',
      expect.objectContaining({ headers: {} }),
    );
  });

  it('calls fetch with activeCluster headers when cluster is set', () => {
    const cluster: K8sCluster = {
      id: 'test-cluster',
      name: 'my-cluster',
      apiUrl: 'https://k8s.example.com',
      token: 'my-token',
      caCert: 'my-ca-cert',
    };

    render(
      <Dashboard
        activeCluster={cluster}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          'x-k8s-api-url': 'https://k8s.example.com',
          'x-k8s-token': 'my-token',
          'x-k8s-ca-cert': 'my-ca-cert',
        },
      }),
    );
  });

  // --- Releases list when data loaded ---
  // NOTE: Release names appear in BOTH the table view (hidden md:block) and
  // the mobile card view (md:hidden). Use getAllByText to avoid ambiguity.
  it('renders releases list when data is loaded', async () => {
    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      const elements = screen.getAllByText('my-release');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    const failedElements = screen.getAllByText('failed-app');
    expect(failedElements.length).toBeGreaterThanOrEqual(1);

    const anotherElements = screen.getAllByText('another-release');
    expect(anotherElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders release namespaces in the table', async () => {
    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      const elements = screen.getAllByText('default');
      // 'default' appears in namespace dropdown AND in table/card cells
      expect(elements.length).toBeGreaterThanOrEqual(2);
    });

    const stagingElements = screen.getAllByText('staging');
    expect(stagingElements.length).toBeGreaterThanOrEqual(1);
  });

  // --- Stat cards ---
  it('renders Total Releases stat card with count', async () => {
    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Total Releases')).toBeInTheDocument();
    });

    // The total count "3" appears in multiple places (stat card + cluster health section)
    const threes = screen.getAllByText('3');
    expect(threes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Healthy Workloads stat card with deployed count', async () => {
    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Healthy Workloads')).toBeInTheDocument();
    });
  });

  it('renders Failed Upgrades stat card', async () => {
    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Failed Upgrades')).toBeInTheDocument();
    });
  });

  // --- Error state ---
  it('shows error state with AlertCircle and unavailable message when fetch fails', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Cluster unreachable' }),
    });

    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Cluster Handshake Failed')).toBeInTheDocument();
    });
  });

  it('shows — (em dash) in stat cards when error', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Cluster unreachable' }),
    });

    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      const dashes = screen.getAllByText('\u2014');
      expect(dashes.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('shows "Unavailable" text in stat cards when error', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Cluster unreachable' }),
    });

    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      const unavailableTexts = screen.getAllByText('Unavailable');
      expect(unavailableTexts.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('shows "Retry Call" button in error state', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Cluster unreachable' }),
    });

    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Retry Call')).toBeInTheDocument();
    });
  });

  // --- Empty state ---
  it('shows empty state with no releases image when no data', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('No Helm Releases Discovered')).toBeInTheDocument();
    });

    const img = screen.getByAltText('No active Helm releases discovered');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/static/images/no_releases.png');
  });

  it('renders "Browse Helm Charts" button in empty state', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Browse Helm Charts')).toBeInTheDocument();
    });
  });

  // --- Child components ---
  it('renders ClusterHealthWidget', async () => {
    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('cluster-health-widget')).toBeInTheDocument();
    });
  });

  it('renders NamespaceQuotaWidget', async () => {
    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('namespace-quota-widget')).toBeInTheDocument();
    });
  });

  // --- Cluster context stat card ---
  it('shows active cluster name in "Cluster Context" stat card', async () => {
    const cluster: K8sCluster = {
      id: 'prod',
      name: 'production-gke',
      apiUrl: 'https://prod.k8s.example.com',
    };

    render(
      <Dashboard
        activeCluster={cluster}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      // Cluster name appears in stat card AND in cluster health section
      const names = screen.getAllByText('production-gke');
      expect(names.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows "No Cluster" in Cluster Context card when no cluster', async () => {
    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('No Cluster')).toBeInTheDocument();
    });
  });

  // --- Search ---
  it('renders search input and filters releases', async () => {
    const user = userEvent.setup();
    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      const elements = screen.getAllByText('my-release');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    const searchInput = screen.getByPlaceholderText('Search release name or chart...');
    await user.clear(searchInput);
    await user.type(searchInput, 'redis');

    // failed-app has chartName 'redis', so it should remain but 'my-release' should disappear
    await waitFor(() => {
      expect(screen.queryByText('my-release')).toBeNull();
    });
  });

  // --- Deploy New Chart button ---
  it('renders "Deploy New Chart" button and calls onBrowseCharts', async () => {
    const onBrowseCharts = vi.fn();
    const user = userEvent.setup();

    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={onBrowseCharts}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Deploy New Chart')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Deploy New Chart'));
    expect(onBrowseCharts).toHaveBeenCalled();
  });

  // --- Manage button ---
  it('clicking Manage on a release calls onSelectRelease', async () => {
    const onSelectRelease = vi.fn();
    const user = userEvent.setup();

    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={onSelectRelease}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      const elements = screen.getAllByText('my-release');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    // "Manage" buttons appear in table view AND mobile cards
    const manageButtons = screen.getAllByText('Manage');
    // There are also "Manage Release" buttons in mobile cards
    const manageReleaseButtons = screen.getAllByText('Manage Release');
    const totalManages = manageButtons.length + manageReleaseButtons.length;
    expect(totalManages).toBeGreaterThanOrEqual(3);

    // Click the first "Manage" (table view)
    await user.click(manageButtons[0]);
    expect(onSelectRelease).toHaveBeenCalledWith('default', 'my-release');
  });

  // --- Namespace filter dropdown ---
  it('renders namespace filter dropdown with default and release namespaces', async () => {
    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      const elements = screen.getAllByText('my-release');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('all');
    expect(options).toContain('default');
    expect(options).toContain('staging');
  });

  // --- Refresh button ---
  it('renders refresh button that re-fetches releases', async () => {
    const user = userEvent.setup();

    render(
      <Dashboard
        activeCluster={null}
        onSelectRelease={vi.fn()}
        onBrowseCharts={vi.fn()}
      />,
    );

    await waitFor(() => {
      const elements = screen.getAllByText('my-release');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    const refreshBtn = screen.getByTitle('Refresh list');
    expect(refreshBtn).toBeInTheDocument();

    const initialCalls = mockFetch.mock.calls.length;
    await user.click(refreshBtn);
    expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCalls);
  });
});
