import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock motion/react (even though ResourceUsageChart doesn't directly use it,
// child components or recharts render paths might)
vi.mock('motion/react', () => ({
  motion: {
    div: 'div',
    span: 'span',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock recharts components to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => {
  const MockResponsiveContainer = ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  );

  const MockAreaChart = ({ children, data }: any) => (
    <div data-testid="area-chart" data-points={data?.length}>
      {children}
    </div>
  );

  const MockArea = ({ name, dataKey, stroke, fill }: any) => (
    <div data-testid={`area-${dataKey}`} data-name={name} data-stroke={stroke} data-fill={fill} />
  );

  const MockCartesianGrid = (_props: any) => <div data-testid="cartesian-grid" />;
  const MockXAxis = (props: any) => <div data-testid="x-axis" data-key={props.dataKey} />;
  const MockYAxis = (props: any) => <div data-testid="y-axis" data-unit={props.unit} />;
  const MockTooltip = (_props: any) => <div data-testid="tooltip" />;
  const MockLegend = (_props: any) => <div data-testid="legend" />;
  const MockReferenceLine = ({ y, stroke, label }: any) => (
    <div data-testid="reference-line" data-y={y} data-stroke={stroke}>
      {label?.value && <span data-testid="ref-label">{label.value}</span>}
    </div>
  );

  return {
    __esModule: true,
    ResponsiveContainer: MockResponsiveContainer,
    AreaChart: MockAreaChart,
    Area: MockArea,
    CartesianGrid: MockCartesianGrid,
    XAxis: MockXAxis,
    YAxis: MockYAxis,
    Tooltip: MockTooltip,
    Legend: MockLegend,
    ReferenceLine: MockReferenceLine,
  };
});

import type { K8sCluster } from '@/types/k8s-cluster.type';

import ResourceUsageChart from '@/components/ResourceUsageChart';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockMetrics(overrides: any[] = []) {
  const base = [
    {
      time: '12:00',
      timestamp: '2025-06-01T12:00:00Z',
      cpuUsage: 150,
      cpuRequest: 200,
      cpuLimit: 500,
      memUsage: 256,
      memRequest: 512,
      memLimit: 1024,
    },
    {
      time: '12:01',
      timestamp: '2025-06-01T12:01:00Z',
      cpuUsage: 180,
      cpuRequest: 200,
      cpuLimit: 500,
      memUsage: 300,
      memRequest: 512,
      memLimit: 1024,
    },
    {
      time: '12:02',
      timestamp: '2025-06-01T12:02:00Z',
      cpuUsage: 160,
      cpuRequest: 200,
      cpuLimit: 500,
      memUsage: 280,
      memRequest: 512,
      memLimit: 1024,
    },
  ];

  if (overrides.length > 0) {
    return overrides.map((o, i) => ({ ...(base[i] || base[0]), ...o }));
  }

  return base;
}

function defaultMetrics() {
  return mockMetrics();
}

function mockUsageResponse(overrides: Record<string, any> = {}) {
  return {
    metrics: defaultMetrics(),
    podsFound: true,
    ...overrides,
  };
}

const defaultCluster: K8sCluster = {
  id: 'test-cluster',
  name: 'my-cluster',
  apiUrl: 'https://k8s.example.com',
};

describe('ResourceUsageChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUsageResponse(),
    });
  });

  const defaultProps = {
    name: 'my-release',
    namespace: 'default',
    activeCluster: defaultCluster,
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  it('renders loading spinner initially when no metrics are available', () => {
    // Keep the fetch pending so loading stays true and metrics stays empty
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<ResourceUsageChart {...defaultProps} />);

    expect(
      screen.getByText('Loading container resources & performance metrics...'),
    ).toBeInTheDocument();

    // The spinner has animate-spin class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Successful data rendering
  // ---------------------------------------------------------------------------
  it('renders chart area when metrics are loaded', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });
  });

  it('renders the chart with the correct number of data points', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      const chart = screen.getByTestId('area-chart');
      expect(chart.dataset.points).toBe('3');
    });
  });

  it('renders "Inspecting metrics queue..." when metrics array is empty but not loading', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ metrics: [], podsFound: false }),
    });

    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText('Inspecting metrics queue...'),
      ).toBeInTheDocument();
    });
  });

  it('shows "Healthy" status badge when usage is below threshold', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });
  });

  it('shows "Threshold Exceeded" badge when usage exceeds threshold', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        mockUsageResponse({
          metrics: mockMetrics([
            { cpuUsage: 450, cpuLimit: 500 }, // 90% of limit, exceeds 80% default
          ]),
        }),
    });

    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Threshold Exceeded')).toBeInTheDocument();
    });
  });

  it('shows "High Load" badge when usage is between 80% and 100% of threshold', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        mockUsageResponse({
          metrics: mockMetrics([
            { cpuUsage: 340, cpuLimit: 500 }, // 68% of limit, 85% of 80% threshold
          ]),
        }),
    });

    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('High Load')).toBeInTheDocument();
    });
  });

  it('renders current utilization value in the stat card', async () => {
    // Last data point: cpuUsage=160m, memUsage=280Mi
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      // CPU is the default tab
      expect(screen.getByText('160m')).toBeInTheDocument();
    });
  });

  it('renders configured requests value in the stat card', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('200m')).toBeInTheDocument();
    });
  });

  it('renders hard limits value in the stat card', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('500m')).toBeInTheDocument();
    });
  });

  it('shows percentage of limit next to utilization', async () => {
    // 160 / 500 = 32%
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('(32% limit)')).toBeInTheDocument();
    });
  });

  it('shows pods found message when podsFound is true', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Aggregated from active Kubernetes Pod containers spec & request bounds',
        ),
      ).toBeInTheDocument();
    });
  });

  it('shows no-pods message when podsFound is false', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        mockUsageResponse({
          podsFound: false,
          metrics: defaultMetrics(),
        }),
    });

    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Projected release consumption baseline (No active pods discovered)',
        ),
      ).toBeInTheDocument();
    });
  });

  it('renders footer with resource quota message', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Resource quotas active inside virtual cluster control plane',
        ),
      ).toBeInTheDocument();
    });
  });

  it('footer shows "THRESHOLD EXCEEDED" when alert is active', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        mockUsageResponse({
          metrics: mockMetrics([
            { cpuUsage: 450, cpuLimit: 500, memUsage: 256, memLimit: 1024 },
          ]),
        }),
    });

    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/THRESHOLD EXCEEDED/)).toBeInTheDocument();
    });
  });

  it('footer shows "normal" when within threshold', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/normal/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // CPU / Memory tab switching
  // ---------------------------------------------------------------------------
  it('renders CPU tab as active by default', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    const cpuButton = screen.getByText('CPU').closest('button');
    expect(cpuButton).toBeInTheDocument();
    // Active tab should have specific styling
    expect(cpuButton?.className).toContain('text-blue');
  });

  it('switches to Memory tab when Memory button is clicked', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Memory'));

    // The memory data should now be displayed instead of CPU data
    // Last metric: memUsage=280Mi
    await waitFor(() => {
      expect(screen.getByText('280Mi')).toBeInTheDocument();
    });
  });

  it('displays memory-specific values after switching to memory tab', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Memory'));

    await waitFor(() => {
      // Memory stats should show
      expect(screen.getByText('280Mi')).toBeInTheDocument(); // current usage
      expect(screen.getByText('512Mi')).toBeInTheDocument(); // request
      expect(screen.getByText('1024Mi')).toBeInTheDocument(); // limit
    });
  });

  it('switches back to CPU after visiting Memory tab', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    // Switch to Memory first
    await userEvent.click(screen.getByText('Memory'));
    await waitFor(() => {
      expect(screen.getByText('280Mi')).toBeInTheDocument();
    });

    // Switch back to CPU
    await userEvent.click(screen.getByText('CPU'));

    await waitFor(() => {
      expect(screen.getByText('160m')).toBeInTheDocument();
    });
  });

  it('active tab button has active styling', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    const cpuButton = screen.getByText('CPU').closest('button');
    expect(cpuButton?.className).toContain('bg-white');

    await userEvent.click(screen.getByText('Memory'));

    const memoryButton = screen.getByText('Memory').closest('button');
    expect(memoryButton?.className).toContain('bg-white');
  });

  // ---------------------------------------------------------------------------
  // Threshold input
  // ---------------------------------------------------------------------------
  it('renders threshold input with default value of 80', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      const input = screen.getByDisplayValue('80') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.type).toBe('number');
    });
  });

  it('updates CPU threshold when a new value is entered while on CPU tab', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      expect(screen.getByDisplayValue('80')).toBeInTheDocument();
    });

    const input = screen.getByDisplayValue('80') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '90');

    expect(input).toHaveValue(90);
  });

  it('updates Memory threshold when a new value is entered while on Memory tab', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    // Switch to memory tab
    await userEvent.click(screen.getByText('Memory'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('80')).toBeInTheDocument();
    });

    const input = screen.getByDisplayValue('80') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '70');

    expect(input).toHaveValue(70);
  });

  it('shows different threshold values for CPU and Memory tabs independently', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      expect(screen.getByDisplayValue('80')).toBeInTheDocument();
    });

    // Change CPU threshold
    const cpuInput = screen.getByDisplayValue('80') as HTMLInputElement;
    await userEvent.clear(cpuInput);
    await userEvent.type(cpuInput, '90');

    // Switch to memory
    await userEvent.click(screen.getByText('Memory'));

    // Memory should still be at default 80
    await waitFor(() => {
      expect(screen.getByDisplayValue('80')).toBeInTheDocument();
    });

    // Switch back to CPU - should still be 90
    await userEvent.click(screen.getByText('CPU'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('90')).toBeInTheDocument();
    });
  });

  it('reference line updates when threshold changes', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      // Default threshold is 80%, reference line should show that
      const refLabel = screen.getByTestId('ref-label');
      expect(refLabel.textContent).toContain('80%');
    });

    // Change threshold
    const input = screen.getByDisplayValue('80') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '50');

    await waitFor(() => {
      const refLabel = screen.getByTestId('ref-label');
      expect(refLabel.textContent).toContain('50%');
    });
  });

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  it('shows error state when fetch fails and no metrics cached', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error('Metrics server not reachable'));

    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Metrics Offline')).toBeInTheDocument();
      expect(
        screen.getByText('Metrics server not reachable'),
      ).toBeInTheDocument();
    });
  });

  it('shows error state when API returns non-ok', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Service Unavailable',
      json: async () => ({}),
    });

    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Metrics Offline')).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to fetch resource metrics/),
      ).toBeInTheDocument();
    });
  });

  it('shows default error message when fetch rejects without a message', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error(''));

    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to retrieve telemetry.'),
      ).toBeInTheDocument();
    });
  });

  it('shows Retry Telemetry button in error state', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error('Boom'));

    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Retry Telemetry')).toBeInTheDocument();
    });
  });

  it('retries fetch when Retry Telemetry is clicked', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValueOnce(new Error('First failure'));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsageResponse(),
    });

    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Retry Telemetry')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Retry Telemetry'));

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Refresh button
  // ---------------------------------------------------------------------------
  it('renders a refresh button that re-fetches metrics', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    const initialCalls = mockFetch.mock.calls.length;

    // The refresh button is the one with RefreshCw icon; we find by title
    const refreshBtn = screen.getByTitle('Refresh Metrics');
    await userEvent.click(refreshBtn);

    expect(mockFetch).toHaveBeenCalledTimes(initialCalls + 1);
  });

  // ---------------------------------------------------------------------------
  // Auto-refresh / Live polling toggle
  // ---------------------------------------------------------------------------
  it('shows "Live" auto-refresh toggle by default', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });

  it('switches to "Paused" when auto-refresh is toggled off', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Live'));

    await waitFor(() => {
      expect(screen.getByText('Paused')).toBeInTheDocument();
    });
  });

  it('toggles auto-refresh back on after being paused', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Live'));
    await waitFor(() => {
      expect(screen.getByText('Paused')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Paused'));
    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Fetch URL and headers
  // ---------------------------------------------------------------------------
  it('fetches from the correct release usage endpoint', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/k8s/releases/default/my-release/usage',
        expect.any(Object),
      );
    });
  });

  it('sends cluster headers when activeCluster is provided', async () => {
    const clusterWithAuth: K8sCluster = {
      id: 'auth-cluster',
      name: 'secure-cluster',
      apiUrl: 'https://secure.example.com',
      token: 'bearer-token-xyz',
      caCert: 'ca-cert-data',
    };

    render(
      <ResourceUsageChart
        name="my-release"
        namespace="default"
        activeCluster={clusterWithAuth}
      />,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/k8s/releases/default/my-release/usage',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-k8s-api-url': 'https://secure.example.com',
            'x-k8s-token': 'bearer-token-xyz',
            'x-k8s-ca-cert': 'ca-cert-data',
          }),
        }),
      );
    });
  });

  it('does not include optional headers when cluster lacks token/caCert', async () => {
    const minimalCluster: K8sCluster = {
      id: 'minimal',
      name: 'minimal',
      apiUrl: 'https://minimal.example.com',
    };

    render(
      <ResourceUsageChart
        name="my-release"
        namespace="default"
        activeCluster={minimalCluster}
      />,
    );

    await waitFor(() => {
      const { headers } = mockFetch.mock.calls[0][1];
      expect(headers['x-k8s-api-url']).toBe('https://minimal.example.com');
      expect(headers['x-k8s-token']).toBeUndefined();
      expect(headers['x-k8s-ca-cert']).toBeUndefined();
    });
  });

  it('sends no cluster headers when activeCluster is null', async () => {
    render(
      <ResourceUsageChart
        name="my-release"
        namespace="default"
        activeCluster={null}
      />,
    );

    await waitFor(() => {
      const { headers } = mockFetch.mock.calls[0][1];
      expect(headers).toEqual({});
    });
  });

  // ---------------------------------------------------------------------------
  // Title and UI elements
  // ---------------------------------------------------------------------------
  it('renders "Live Resource Utilization" title', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText('Live Resource Utilization'),
      ).toBeInTheDocument();
    });
  });

  it('renders the three stat cards: Current Utilization, Requests, Limits', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Current Utilization')).toBeInTheDocument();
      expect(screen.getByText('Configured Requests')).toBeInTheDocument();
      expect(screen.getByText('Hard Limits')).toBeInTheDocument();
    });
  });

  it('renders Guaranteed and Max Cap labels', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Guaranteed')).toBeInTheDocument();
      expect(screen.getByText('Max Cap')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Recharts rendered components (via mocks)
  // ---------------------------------------------------------------------------
  it('renders all chart subcomponents', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('legend')).toBeInTheDocument();
      expect(screen.getByTestId('reference-line')).toBeInTheDocument();
    });
  });

  it('renders CPU-specific area series when on CPU tab', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-cpuUsage')).toBeInTheDocument();
      expect(screen.getByTestId('area-cpuRequest')).toBeInTheDocument();
      expect(screen.getByTestId('area-cpuLimit')).toBeInTheDocument();
    });
  });

  it('renders Memory-specific area series when on Memory tab', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Memory'));

    await waitFor(() => {
      expect(screen.getByTestId('area-memUsage')).toBeInTheDocument();
      expect(screen.getByTestId('area-memRequest')).toBeInTheDocument();
      expect(screen.getByTestId('area-memLimit')).toBeInTheDocument();
    });
  });

  it('YAxis shows "m" unit on CPU tab', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      const yAxis = screen.getByTestId('y-axis');
      expect(yAxis.dataset.unit).toBe('m');
    });
  });

  it('YAxis shows "M" unit on Memory tab', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Memory'));

    await waitFor(() => {
      const yAxis = screen.getByTestId('y-axis');
      expect(yAxis.dataset.unit).toBe('M');
    });
  });

  // ---------------------------------------------------------------------------
  // Alert threshold exceeded visual indicators
  // ---------------------------------------------------------------------------
  it('renders CPU area with red stroke when CPU exceeds threshold', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        mockUsageResponse({
          metrics: mockMetrics([
            { cpuUsage: 450, cpuLimit: 500 }, // 90%, exceeds 80% threshold
          ]),
        }),
    });

    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      const cpuArea = screen.getByTestId('area-cpuUsage');
      expect(cpuArea.dataset.stroke).toBe('#ef4444');
    });
  });

  it('renders memory area with purple stroke when memory is within threshold', async () => {
    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    // Switch to memory tab
    await userEvent.click(screen.getByText('Memory'));

    await waitFor(() => {
      const memArea = screen.getByTestId('area-memUsage');
      // Memory usage is 280/1024 ~27%, well within threshold
      expect(memArea.dataset.stroke).toBe('#8b5cf6');
    });
  });

  it('renders memory area with red stroke when memory exceeds threshold', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        mockUsageResponse({
          metrics: mockMetrics([
            { memUsage: 900, memLimit: 1024 }, // ~88%, exceeds 80% threshold
          ]),
        }),
    });

    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    // Default is CPU tab; switch to memory
    await userEvent.click(screen.getByText('Memory'));

    await waitFor(() => {
      const memArea = screen.getByTestId('area-memUsage');
      expect(memArea.dataset.stroke).toBe('#ef4444');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge-case: zero limits
  // ---------------------------------------------------------------------------
  it('handles zero cpuLimit gracefully (shows 0% limit)', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        mockUsageResponse({
          metrics: mockMetrics([
            { cpuUsage: 100, cpuLimit: 0, memUsage: 256, memLimit: 0 },
          ]),
        }),
    });

    render(<ResourceUsageChart {...defaultProps} />);

    await waitFor(() => {
      // When limit is 0, percentOfLimit should be 0
      expect(screen.getByText('(0% limit)')).toBeInTheDocument();
    });
  });
});
