import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock motion/react to avoid animation-related issues in tests
vi.mock('motion/react', () => ({
  motion: {
    div: 'div',
    span: 'span',
    circle: 'circle',
    pre: 'pre',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import type { K8sCluster } from '@/types/k8s-cluster.type';

import ActivityLog from '@/components/ActivityLog';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock URL.createObjectURL and URL.revokeObjectURL for export tests
globalThis.URL.createObjectURL = vi.fn(() => 'blob:test-url');
globalThis.URL.revokeObjectURL = vi.fn();

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

function mockLogEntry(overrides: Record<string, any> = {}) {
  return {
    id: 'log-001',
    timestamp: new Date().toISOString(),
    type: 'helm',
    severity: 'success',
    category: 'install',
    message: 'Helm release installed successfully',
    user: 'admin@example.com',
    ...overrides,
  };
}

function mockLogsData(logs: Record<string, any>[] = []) {
  return logs;
}

const defaultCluster: K8sCluster = {
  id: 'test-cluster',
  name: 'my-cluster',
  apiUrl: 'https://k8s.example.com',
};

describe('ActivityLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        mockLogsData([
          mockLogEntry({ id: '1', severity: 'success', type: 'helm', category: 'install', message: 'Chart installed', user: 'admin' }),
          mockLogEntry({ id: '2', severity: 'warning', type: 'k8s', category: 'cluster', message: 'Node pressure detected', user: undefined }),
          mockLogEntry({ id: '3', severity: 'error', type: 'helm', category: 'upgrade', message: 'Upgrade failed: timeout', user: 'operator' }),
          mockLogEntry({ id: '4', severity: 'info', type: 'k8s', category: 'cluster', message: 'Pod scheduled', user: 'system' }),
        ]),
    });
  });

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  it('shows loading spinner when fetching logs', () => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<ActivityLog activeCluster={defaultCluster} />);

    // The header is always shown
    expect(screen.getByText('Cluster Activity Stream')).toBeInTheDocument();

    // Loading spinner text
    expect(screen.getByText('Pumping real-time events...')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Successful data rendering
  // ---------------------------------------------------------------------------
  it('renders event list when logs are fetched', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Chart installed')).toBeInTheDocument();
      expect(screen.getByText('Node pressure detected')).toBeInTheDocument();
      expect(screen.getByText('Upgrade failed: timeout')).toBeInTheDocument();
      expect(screen.getByText('Pod scheduled')).toBeInTheDocument();
    });
  });

  it('shows severity badges in the log entries', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      // Check for severity icons rendered via lucide-react (CheckCircle2 for success, etc)
      const svgElements = document.querySelectorAll('svg');
      expect(svgElements.length).toBeGreaterThan(0);
    });
  });

  it('shows event details including timestamp and type', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      // Type badges: HELM and K8S EVENT (multiple of each exist)
      const helmBadges = screen.getAllByText('HELM');
      expect(helmBadges.length).toBe(2); // logs 1 and 3 are helm

      const k8sBadges = screen.getAllByText('K8S EVENT');
      expect(k8sBadges.length).toBe(2); // logs 2 and 4 are k8s
    });
  });

  it('shows category badges for log entries', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      // Categories: install (appears once), cluster (appears twice for two k8s logs), upgrade (appears once)
      expect(screen.getByText('install')).toBeInTheDocument();

      const clusterBadges = screen.getAllByText('cluster');
      expect(clusterBadges.length).toBe(2);

      expect(screen.getByText('upgrade')).toBeInTheDocument();
    });
  });

  it('shows user information when available', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getByText('operator')).toBeInTheDocument();
    });
  });

  it('shows severity counter buttons in the header', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      // Total count shows "All (N)"
      expect(screen.getByText('All (4)')).toBeInTheDocument();
      expect(screen.getByText('Success (1)')).toBeInTheDocument();
      expect(screen.getByText('Info (1)')).toBeInTheDocument();
      expect(screen.getByText('Warn (1)')).toBeInTheDocument();
      expect(screen.getByText('Error (1)')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  it('shows error state when fetch fails', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
    });

    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to bind to event stream')).toBeInTheDocument();
    });
  });

  it('shows error message text in the error state', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error('Network timeout'));

    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to bind to event stream')).toBeInTheDocument();
      expect(screen.getByText('Network timeout')).toBeInTheDocument();
    });
  });

  it('shows Reconnect button in error state', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error('Connection lost'));

    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Reconnect')).toBeInTheDocument();
    });
  });

  it('retries fetch when Reconnect button is clicked', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValueOnce(new Error('Connection lost'));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLogsData([mockLogEntry({ id: '1', message: 'Reconnected' })]),
    });

    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Reconnect')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Reconnect'));

    await waitFor(() => {
      expect(screen.getByText('Reconnected')).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  it('shows empty state when no matching activities found', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockLogsData([]),
    });

    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('No matching activities found')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------
  it('filters logs by search query', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Chart installed')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search logs...');
    await userEvent.type(searchInput, 'timeout');

    await waitFor(() => {
      expect(screen.getByText('Upgrade failed: timeout')).toBeInTheDocument();
      expect(screen.queryByText('Chart installed')).not.toBeInTheDocument();
      expect(screen.queryByText('Node pressure detected')).not.toBeInTheDocument();
    });
  });

  it('filters logs by type (Helm Ops)', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Chart installed')).toBeInTheDocument();
    });

    const helmButton = screen.getByText('Helm Ops');
    await userEvent.click(helmButton);

    await waitFor(() => {
      expect(screen.getByText('Chart installed')).toBeInTheDocument();
      expect(screen.getByText('Upgrade failed: timeout')).toBeInTheDocument();
      expect(screen.queryByText('Node pressure detected')).not.toBeInTheDocument();
      expect(screen.queryByText('Pod scheduled')).not.toBeInTheDocument();
    });
  });

  it('filters logs by type (K8s Events)', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Chart installed')).toBeInTheDocument();
    });

    const k8sButton = screen.getByText('K8s Events');
    await userEvent.click(k8sButton);

    await waitFor(() => {
      expect(screen.getByText('Node pressure detected')).toBeInTheDocument();
      expect(screen.getByText('Pod scheduled')).toBeInTheDocument();
      expect(screen.queryByText('Chart installed')).not.toBeInTheDocument();
    });
  });

  it('filters logs by severity', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Chart installed')).toBeInTheDocument();
    });

    // Click the Error severity filter
    const errorButton = screen.getByText('Error (1)');
    await userEvent.click(errorButton);

    await waitFor(() => {
      expect(screen.getByText('Upgrade failed: timeout')).toBeInTheDocument();
      expect(screen.queryByText('Chart installed')).not.toBeInTheDocument();
    });
  });

  it('filters logs by time range', async () => {
    // Create logs with timestamps spread over time
    const oldLog = mockLogEntry({
      id: 'old',
      message: 'Very old log',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    });
    const recentLog = mockLogEntry({
      id: 'recent',
      message: 'Recent log',
      timestamp: new Date(Date.now() - 30 * 1000).toISOString(), // 30 seconds ago
    });

    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockLogsData([oldLog, recentLog]),
    });

    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Very old log')).toBeInTheDocument();
      expect(screen.getByText('Recent log')).toBeInTheDocument();
    });

    // Filter to last 5 minutes
    const timeSelect = screen.getByDisplayValue('All Time');
    await userEvent.selectOptions(timeSelect, '5m');

    await waitFor(() => {
      expect(screen.getByText('Recent log')).toBeInTheDocument();
      expect(screen.queryByText('Very old log')).not.toBeInTheDocument();
    });
  });

  it('resets to All Logs type filter', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Chart installed')).toBeInTheDocument();
    });

    // First filter to Helm
    await userEvent.click(screen.getByText('Helm Ops'));

    await waitFor(() => {
      expect(screen.queryByText('Pod scheduled')).not.toBeInTheDocument();
    });

    // Then reset to All
    await userEvent.click(screen.getByText('All Logs'));

    await waitFor(() => {
      expect(screen.getByText('Pod scheduled')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Expandable log details
  // ---------------------------------------------------------------------------
  it('expands a log entry to show full trace payload when clicked', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Chart installed')).toBeInTheDocument();
    });

    // Click the first log entry row (it has onClick to toggleExpand)
    const logRow = screen.getByText('Chart installed').closest('[class*="cursor-pointer"]');
    if (logRow) {
      await userEvent.click(logRow);
    }

    await waitFor(() => {
      // After expanding, we should see "Full Trace Payload:" label
      expect(screen.getByText('Full Trace Payload:')).toBeInTheDocument();
      // And the log ID in the details
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('collapses an expanded log entry when clicked again', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Chart installed')).toBeInTheDocument();
    });

    const logRow = screen.getByText('Chart installed').closest('[class*="cursor-pointer"]');
    if (logRow) {
      // Expand
      await userEvent.click(logRow);
    }

    await waitFor(() => {
      expect(screen.getByText('Full Trace Payload:')).toBeInTheDocument();
    });

    // Collapse
    if (logRow) {
      await userEvent.click(logRow);
    }

    await waitFor(() => {
      expect(screen.queryByText('Full Trace Payload:')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Refresh button
  // ---------------------------------------------------------------------------
  it('has a force refresh button', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Chart installed')).toBeInTheDocument();
    });

    const refreshBtn = screen.getByTitle('Force refresh');
    expect(refreshBtn).toBeInTheDocument();
  });

  it('triggers fetch when force refresh is clicked', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Chart installed')).toBeInTheDocument();
    });

    const initialCallCount = mockFetch.mock.calls.length;

    const refreshBtn = screen.getByTitle('Force refresh');
    await userEvent.click(refreshBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(initialCallCount + 1);
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-refresh toggle
  // ---------------------------------------------------------------------------
  it('shows "Live Streaming" label by default', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Live Streaming')).toBeInTheDocument();
    });
  });

  it('switches to "Stream Paused" when auto-refresh is toggled off', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Live Streaming')).toBeInTheDocument();
    });

    const autoRefreshBtn = screen.getByTitle('Click to pause streaming');
    await userEvent.click(autoRefreshBtn);

    await waitFor(() => {
      expect(screen.getByText('Stream Paused')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Export dropdown
  // ---------------------------------------------------------------------------
  it('shows export button', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Export Logs')).toBeInTheDocument();
    });
  });

  it('export button is disabled when no logs match filters', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockLogsData([]),
    });

    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      const exportBtn = screen.getByText('Export Logs').closest('button');
      expect(exportBtn).toBeDisabled();
    });
  });

  it('opens export dropdown with format options when clicked', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Export Logs')).toBeInTheDocument();
    });

    const exportBtn = screen.getByText('Export Logs');
    await userEvent.click(exportBtn);

    await waitFor(() => {
      expect(screen.getByText('Export as CSV (.csv)')).toBeInTheDocument();
      expect(screen.getByText('Export as JSON (.json)')).toBeInTheDocument();
    });
  });

  it('triggers CSV download when export as CSV is clicked', async () => {
    // Spy on URL.createObjectURL to verify CSV generation without mocking createElement
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-csv');

    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Export Logs')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Export Logs'));

    await waitFor(() => {
      expect(screen.getByText('Export as CSV (.csv)')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Export as CSV (.csv)'));

    // Verify CSV blob was created
    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled();
      const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
      expect(blob.type).toContain('text/csv');
    });

    createObjectURLSpy.mockRestore();
  });

  it('triggers JSON download when export as JSON is clicked', async () => {
    // Spy on document.createElement only for 'a' elements, letting others through
    const origCreateElement = document.createElement.bind(document);
    const anchorClickSpy = vi.fn();
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string, _options?: ElementCreationOptions) => {
        if (tagName === 'a') {
          const anchor = origCreateElement('a');
          anchor.click = anchorClickSpy;
          return anchor;
        }
        return origCreateElement(tagName, _options);
      });

    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Export Logs')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Export Logs'));

    await waitFor(() => {
      expect(screen.getByText('Export as JSON (.json)')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Export as JSON (.json)'));

    await waitFor(() => {
      expect(anchorClickSpy).toHaveBeenCalled();
    });

    createElementSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Footer
  // ---------------------------------------------------------------------------
  it('renders the footer with event count', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Showing 4 of 4 events')).toBeInTheDocument();
      expect(screen.getByText('Active Connection: REST-Engine proxied')).toBeInTheDocument();
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

    render(<ActivityLog activeCluster={clusterWithAuth} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers).toBeDefined();
      expect(options.headers['x-k8s-api-url']).toBe('https://secure.k8s.example.com');
      expect(options.headers['x-k8s-token']).toBe('bearer-token-123');
      expect(options.headers['x-k8s-ca-cert']).toBe('base64-encoded-cert-data');
    });
  });

  it('does not send cluster headers when activeCluster is null', async () => {
    render(<ActivityLog activeCluster={null} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers).toBeDefined();
      expect(options.headers['x-k8s-api-url']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Re-fetch when activeCluster changes
  // ---------------------------------------------------------------------------
  it('re-fetches logs when activeCluster prop changes', async () => {
    const { rerender } = render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const newCluster: K8sCluster = {
      id: 'cluster-2',
      name: 'second-cluster',
      apiUrl: 'https://k8s-2.example.com',
    };

    rerender(<ActivityLog activeCluster={newCluster} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Search filtering by user
  // ---------------------------------------------------------------------------
  it('filters logs by user in search query', async () => {
    render(<ActivityLog activeCluster={defaultCluster} />);

    await waitFor(() => {
      expect(screen.getByText('Chart installed')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search logs...');
    await userEvent.type(searchInput, 'admin');

    await waitFor(() => {
      expect(screen.getByText('Chart installed')).toBeInTheDocument();
      expect(screen.queryByText('Node pressure detected')).not.toBeInTheDocument();
    });
  });
});
