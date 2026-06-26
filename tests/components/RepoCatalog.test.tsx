import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChartRepo } from '@/types/chart-repo.type';
import type { HelmChart } from '@/types/helm-chart.type';

import RepoCatalog from '@/components/RepoCatalog';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockRepos(): ChartRepo[] {
  return [
    { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' },
    { name: 'prometheus-community', url: 'https://prometheus-community.github.io/helm-charts' },
    { name: 'grafana', url: 'https://grafana.github.io/helm-charts' },
  ];
}

function mockCharts(): HelmChart[] {
  return [
    {
      name: 'nginx',
      repo: 'bitnami',
      description: 'NGINX Open Source is a web server',
      version: '15.1.0',
      appVersion: '1.27.0',
    },
    {
      name: 'redis',
      repo: 'bitnami',
      description: 'Redis is an open source key-value store',
      version: '18.2.0',
      appVersion: '7.4.0',
    },
    {
      name: 'grafana',
      repo: 'grafana',
      description: 'The leading tool for querying and visualizing metrics',
      version: '8.3.0',
      appVersion: '11.2.0',
    },
  ];
}

function setupDefaultMocks() {
  mockFetch.mockReset();
  // First call: fetch repos
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockRepos(),
  });
  // Second call: fetch charts (triggered by useEffect after repos load)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockCharts(),
  });
  // Fallback for any additional calls
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => [],
  });
}

describe('RepoCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // Helper to get the sidebar element
  function getSidebar() {
    return document.querySelector('.lg\\:col-span-1') as HTMLElement;
  }

  // --- Repo sidebar ---
  it('renders "Chart Repositories" sidebar header', async () => {
    render(<RepoCatalog onDeployChart={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Chart Repositories')).toBeInTheDocument();
    });
  });

  it('renders "All Repositories" button in sidebar', async () => {
    render(<RepoCatalog onDeployChart={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('All Repositories')).toBeInTheDocument();
    });
  });

  it('renders repo list items after fetch', async () => {
    render(<RepoCatalog onDeployChart={vi.fn()} />);

    // Wait for repos to appear in the sidebar.
    // NOTE: 'bitnami' appears in the sidebar AND in chart cards (repo badge).
    // Scope the query to the sidebar only.
    await waitFor(() => {
      const sidebar = getSidebar();
      expect(within(sidebar).getByText('bitnami')).toBeInTheDocument();
    });

    const sidebar = getSidebar();
    expect(within(sidebar).getByText('prometheus-community')).toBeInTheDocument();
    expect(within(sidebar).getByText('grafana')).toBeInTheDocument();
  });

  // --- Auto-detect and Add buttons ---
  it('renders "Auto-detect" button', async () => {
    render(<RepoCatalog onDeployChart={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Auto-detect')).toBeInTheDocument();
    });
  });

  it('renders "Add" button', async () => {
    render(<RepoCatalog onDeployChart={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Add')).toBeInTheDocument();
    });
  });

  it('clicking Auto-detect calls /api/repos/auto-detect', async () => {
    const user = userEvent.setup();

    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockRepos() });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockCharts() });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ repos: mockRepos(), added: [] }) });
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    render(<RepoCatalog onDeployChart={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Auto-detect')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Auto-detect'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/repos/auto-detect',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('clicking Add toggles the add repo form', async () => {
    const user = userEvent.setup();
    render(<RepoCatalog onDeployChart={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Add')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Add Repo')).toBeInTheDocument();
    });
  });

  // --- Add repo form ---
  it('shows add repo form with name, url inputs and submit button', async () => {
    const user = userEvent.setup();
    render(<RepoCatalog onDeployChart={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Add')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText('Repo Name')).toBeInTheDocument();
      expect(screen.getByText('Repo URL')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. bitnami')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('https://...')).toBeInTheDocument();
    });
  });

  // --- Search input ---
  it('renders search input', async () => {
    render(<RepoCatalog onDeployChart={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Search charts (e.g. nginx, redis, grafana...)'),
      ).toBeInTheDocument();
    });
  });

  it('search input filters charts', async () => {
    const user = userEvent.setup();
    render(<RepoCatalog onDeployChart={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('nginx')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      'Search charts (e.g. nginx, redis, grafana...)',
    );
    await user.clear(searchInput);
    await user.type(searchInput, 'redis');

    await waitFor(() => {
      expect(screen.getByText('redis')).toBeInTheDocument();
      expect(screen.queryByText('nginx')).toBeNull();
    });
  });

  // --- Selecting repo filters charts ---
  it('selecting a repo fetches filtered charts', async () => {
    const user = userEvent.setup();

    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockRepos() });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockCharts() });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCharts().filter((c) => c.repo === 'bitnami'),
    });
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    render(<RepoCatalog onDeployChart={vi.fn()} />);

    // Wait for sidebar repos to load
    await waitFor(() => {
      const sidebar = getSidebar();
      expect(within(sidebar).getByText('bitnami')).toBeInTheDocument();
    });

    // Click bitnami in sidebar (not the chart card badge)
    const sidebar = getSidebar();
    const bitnamiSidebarItem = within(sidebar).getByText('bitnami');
    await user.click(bitnamiSidebarItem);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('repo=bitnami'),
      );
    });
  });

  // --- Chart cards ---
  it('renders chart cards with name, version, and deploy button', async () => {
    render(<RepoCatalog onDeployChart={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('nginx')).toBeInTheDocument();
    });

    const deployButtons = screen.getAllByText('Deploy');
    expect(deployButtons.length).toBe(3);
  });

  it('clicking Deploy on a chart calls onDeployChart', async () => {
    const onDeployChart = vi.fn();
    const user = userEvent.setup();

    render(<RepoCatalog onDeployChart={onDeployChart} />);

    await waitFor(() => {
      expect(screen.getByText('nginx')).toBeInTheDocument();
    });

    const deployButtons = screen.getAllByText('Deploy');
    await user.click(deployButtons[0]);

    expect(onDeployChart).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'nginx', repo: 'bitnami' }),
    );
  });

  it('shows "No Charts Match Your Search" when search yields no results', async () => {
    const user = userEvent.setup();
    render(<RepoCatalog onDeployChart={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('nginx')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      'Search charts (e.g. nginx, redis, grafana...)',
    );
    await user.clear(searchInput);
    await user.type(searchInput, 'nonexistentchartxyz');

    await waitFor(() => {
      expect(screen.getByText('No Charts Match Your Search')).toBeInTheDocument();
    });
  });

  // --- Loading state ---
  it('shows loading spinner while fetching charts', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockRepos() });
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    render(<RepoCatalog onDeployChart={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Querying active chart repositories...')).toBeInTheDocument();
    });
  });

  // --- External search query prop ---
  it('uses passed searchQuery prop when onSearchQueryChange is provided', async () => {
    render(
      <RepoCatalog
        onDeployChart={vi.fn()}
        searchQuery="redis"
        onSearchQueryChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      const input = screen.getByPlaceholderText(
        'Search charts (e.g. nginx, redis, grafana...)',
      ) as HTMLInputElement;
      expect(input.value).toBe('redis');
    });
  });

  // --- Remove repo ---
  it('clicking trash icon on a repo removes it', async () => {
    const user = userEvent.setup();

    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockRepos() });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockCharts() });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ repos: mockRepos().filter((r) => r.name !== 'bitnami') }),
    });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockCharts() });
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<RepoCatalog onDeployChart={vi.fn()} />);

    // Wait for sidebar to render
    await waitFor(() => {
      const sidebar = getSidebar();
      expect(within(sidebar).getByText('bitnami')).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByTitle('Remove repo');
    expect(removeButtons.length).toBeGreaterThan(0);

    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/repos/bitnami',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    vi.restoreAllMocks();
  });
});
