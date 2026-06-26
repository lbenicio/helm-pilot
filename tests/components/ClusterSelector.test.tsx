import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { K8sCluster } from '@/types/k8s-cluster.type';

import ClusterSelector from '@/components/ClusterSelector';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockCluster(overrides: Partial<K8sCluster> = {}): K8sCluster {
  return {
    id: 'test-cluster',
    name: 'production-gke',
    apiUrl: 'https://prod.k8s.example.com',
    token: 'my-token',
    caCert: 'my-ca-cert',
    ...overrides,
  };
}

describe('ClusterSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Default: mock the health check response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, latencyMs: 50 }),
    });
  });

  function renderSelector(props: Partial<{
    clusters: K8sCluster[];
    activeCluster: K8sCluster | null;
    onSelectCluster: (c: K8sCluster | null) => void;
    onAddCluster: (c: K8sCluster) => void;
    onRemoveCluster: (id: string) => void;
  }> = {}) {
    const defaultProps = {
      clusters: [],
      activeCluster: mockCluster(),
      onSelectCluster: vi.fn(),
      onAddCluster: vi.fn(),
      onRemoveCluster: vi.fn(),
      ...props,
    };
    return render(<ClusterSelector {...defaultProps} />);
  }

  // --- Shows active cluster name ---
  it('shows active cluster name in the button', async () => {
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });
  });

  it('shows "Cluster" fallback when no active cluster', async () => {
    renderSelector({ activeCluster: null });

    await waitFor(() => {
      expect(screen.getByText('Cluster')).toBeInTheDocument();
    });
  });

  // --- Dropdown opens on click ---
  it('opens dropdown on click', async () => {
    const user = userEvent.setup();
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });

    await user.click(screen.getByText('production-gke'));

    await waitFor(() => {
      expect(screen.getByText('Clusters & Profiles')).toBeInTheDocument();
    });
  });

  it('shows "Add Cluster" button in dropdown', async () => {
    const user = userEvent.setup();
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });

    await user.click(screen.getByText('production-gke'));

    await waitFor(() => {
      expect(screen.getByText('Add Cluster')).toBeInTheDocument();
    });
  });

  // --- API Status in dropdown ---
  it('shows API Status section in dropdown', async () => {
    const user = userEvent.setup();
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });

    await user.click(screen.getByText('production-gke'));

    await waitFor(() => {
      expect(screen.getByText('API Status:')).toBeInTheDocument();
    });
  });

  it('pings cluster health on mount', async () => {
    renderSelector();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/k8s/cluster-health',
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  it('shows healthy status when ping succeeds', async () => {
    const user = userEvent.setup();
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });

    await user.click(screen.getByText('production-gke'));

    await waitFor(() => {
      const healthyElements = screen.getAllByText('healthy');
      expect(healthyElements.length).toBeGreaterThan(0);
    });
  });

  it('shows offline status when ping fails', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error('Network error'));

    const user = userEvent.setup();
    renderSelector({ activeCluster: null });

    await waitFor(() => {
      expect(screen.getByText('Cluster')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cluster'));

    await waitFor(() => {
      const offlineElements = screen.getAllByText('offline');
      expect(offlineElements.length).toBeGreaterThan(0);
    });
  });

  // --- Default cluster item ---
  it('shows default cluster item when activeCluster has id "default"', async () => {
    const user = userEvent.setup();
    const defaultCluster: K8sCluster = {
      id: 'default',
      name: 'Default Cluster',
      apiUrl: 'https://default.k8s.local',
    };

    renderSelector({ activeCluster: defaultCluster });

    // Wait for the button to show the cluster name
    await waitFor(() => {
      expect(screen.getByText('Default Cluster')).toBeInTheDocument();
    });

    // Open the dropdown
    await user.click(screen.getByText('Default Cluster'));

    // The default cluster item shows in dropdown with green styling
    // and a check icon next to it
    await waitFor(() => {
      // Should see the cluster details in the dropdown
      const clusterItems = screen.getAllByText('Default Cluster');
      expect(clusterItems.length).toBeGreaterThanOrEqual(1);
      // Should show the API URL
      expect(screen.getByText('https://default.k8s.local')).toBeInTheDocument();
    });
  });

  // --- User-added clusters ---
  it('shows user-added clusters in dropdown', async () => {
    const user = userEvent.setup();
    const addedClusters: K8sCluster[] = [
      { id: 'cluster-1', name: 'staging', apiUrl: 'https://staging.k8s.example.com' },
      { id: 'cluster-2', name: 'dev', apiUrl: 'https://dev.k8s.example.com' },
    ];

    renderSelector({ clusters: addedClusters, activeCluster: addedClusters[0] });

    await waitFor(() => {
      expect(screen.getByText('staging')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staging'));

    await waitFor(() => {
      expect(screen.getByText('dev')).toBeInTheDocument();
    });
  });

  it('clicking a user-added cluster calls onSelectCluster', async () => {
    const user = userEvent.setup();
    const onSelectCluster = vi.fn();
    const addedClusters: K8sCluster[] = [
      { id: 'cluster-1', name: 'staging', apiUrl: 'https://staging.k8s.example.com' },
    ];

    renderSelector({
      clusters: addedClusters,
      activeCluster: mockCluster(),
      onSelectCluster,
    });

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });

    await user.click(screen.getByText('production-gke'));

    await waitFor(() => {
      expect(screen.getByText('staging')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staging'));

    expect(onSelectCluster).toHaveBeenCalledWith(addedClusters[0]);
  });

  // --- Add Cluster form ---
  it('shows "Add Cluster" form when Add Cluster is clicked', async () => {
    const user = userEvent.setup();
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });

    await user.click(screen.getByText('production-gke'));

    await waitFor(() => {
      expect(screen.getByText('Add Cluster')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Cluster'));

    await waitFor(() => {
      expect(screen.getByText('Cluster Nickname')).toBeInTheDocument();
      expect(screen.getByText('API Server URL')).toBeInTheDocument();
      expect(screen.getByText('Save Cluster')).toBeInTheDocument();
      expect(screen.getByText('Test Connection')).toBeInTheDocument();
    });
  });

  it('Cancel button in add form closes the form', async () => {
    const user = userEvent.setup();
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });

    await user.click(screen.getByText('production-gke'));
    await waitFor(() => expect(screen.getByText('Add Cluster')).toBeInTheDocument());

    await user.click(screen.getByText('Add Cluster'));
    await waitFor(() => expect(screen.getByText('Save Cluster')).toBeInTheDocument());

    await user.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByText('Save Cluster')).toBeNull();
    });
  });

  // --- Connection test ---
  it('Test Connection calls /api/k8s/test', async () => {
    const user = userEvent.setup();
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });

    await user.click(screen.getByText('production-gke'));
    await waitFor(() => expect(screen.getByText('Add Cluster')).toBeInTheDocument());

    await user.click(screen.getByText('Add Cluster'));
    await waitFor(() => expect(screen.getByText('Test Connection')).toBeInTheDocument());

    // Fill in form fields
    const nameInput = screen.getByPlaceholderText('e.g. Production GKE');
    const urlInput = screen.getByPlaceholderText('https://10.100.0.1:6443');

    await user.type(nameInput, 'my-cluster');
    await user.type(urlInput, 'https://my.k8s.local');

    // Reset mock for the test call
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, namespaces: ['default', 'staging'] }),
    });

    await user.click(screen.getByText('Test Connection'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/k8s/test',
        expect.objectContaining({
          headers: {
            'x-k8s-api-url': 'https://my.k8s.local',
            'x-k8s-ca-cert': '',
          },
        }),
      );
    });
  });

  it('shows success message after successful connection test', async () => {
    const user = userEvent.setup();
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });

    await user.click(screen.getByText('production-gke'));
    await waitFor(() => expect(screen.getByText('Add Cluster')).toBeInTheDocument());

    await user.click(screen.getByText('Add Cluster'));
    await waitFor(() => expect(screen.getByText('Test Connection')).toBeInTheDocument());

    const nameInput = screen.getByPlaceholderText('e.g. Production GKE');
    const urlInput = screen.getByPlaceholderText('https://10.100.0.1:6443');

    await user.type(nameInput, 'my-cluster');
    await user.type(urlInput, 'https://my.k8s.local');

    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, namespaces: ['default', 'staging'] }),
    });

    await user.click(screen.getByText('Test Connection'));

    await waitFor(() => {
      expect(
        screen.getByText(/Successfully connected! Found namespaces: default, staging/),
      ).toBeInTheDocument();
    });
  });

  it('shows error message after failed connection test', async () => {
    const user = userEvent.setup();
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });

    await user.click(screen.getByText('production-gke'));
    await waitFor(() => expect(screen.getByText('Add Cluster')).toBeInTheDocument());

    await user.click(screen.getByText('Add Cluster'));
    await waitFor(() => expect(screen.getByText('Test Connection')).toBeInTheDocument());

    const nameInput = screen.getByPlaceholderText('e.g. Production GKE');
    const urlInput = screen.getByPlaceholderText('https://10.100.0.1:6443');

    await user.type(nameInput, 'my-cluster');
    await user.type(urlInput, 'https://my.k8s.local');

    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: 'Connection refused' }),
    });

    await user.click(screen.getByText('Test Connection'));

    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeInTheDocument();
    });
  });

  // --- Save Cluster ---
  it('submitting form calls onAddCluster and onSelectCluster', async () => {
    const user = userEvent.setup();
    const onAddCluster = vi.fn();
    const onSelectCluster = vi.fn();

    renderSelector({ onAddCluster, onSelectCluster });

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });

    await user.click(screen.getByText('production-gke'));
    await waitFor(() => expect(screen.getByText('Add Cluster')).toBeInTheDocument());

    await user.click(screen.getByText('Add Cluster'));
    await waitFor(() => expect(screen.getByText('Save Cluster')).toBeInTheDocument());

    const nameInput = screen.getByPlaceholderText('e.g. Production GKE');
    const urlInput = screen.getByPlaceholderText('https://10.100.0.1:6443');

    await user.type(nameInput, 'my-cluster');
    await user.type(urlInput, 'https://my.k8s.local');

    await user.click(screen.getByText('Save Cluster'));

    expect(onAddCluster).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'my-cluster',
        apiUrl: 'https://my.k8s.local',
      }),
    );
  });

  // --- Remove cluster ---
  it('clicking trash icon on a cluster calls onRemoveCluster', async () => {
    const user = userEvent.setup();
    const onRemoveCluster = vi.fn();
    const addedClusters: K8sCluster[] = [
      { id: 'cluster-1', name: 'staging', apiUrl: 'https://staging.k8s.example.com' },
    ];

    renderSelector({
      clusters: addedClusters,
      activeCluster: mockCluster(),
      onRemoveCluster,
    });

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });

    await user.click(screen.getByText('production-gke'));
    await waitFor(() => expect(screen.getByText('staging')).toBeInTheDocument());

    // Find the trash button by its title
    const removeBtn = screen.getByTitle('Remove profile');
    await user.click(removeBtn);

    expect(onRemoveCluster).toHaveBeenCalledWith('cluster-1');
  });

  // --- Ping Now button ---
  it('shows "Ping Now" refresh button in dropdown', async () => {
    const user = userEvent.setup();
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText('production-gke')).toBeInTheDocument();
    });

    await user.click(screen.getByText('production-gke'));

    await waitFor(() => {
      expect(screen.getByTitle('Ping Now')).toBeInTheDocument();
    });
  });
});
