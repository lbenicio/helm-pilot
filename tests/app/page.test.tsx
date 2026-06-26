import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRouterPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

const mockSetGlobalSearchQuery = vi.fn();
const mockSetSelectedNamespace = vi.fn();
const mockUseApp = vi.fn();

vi.mock('@/contexts/AppContext', () => ({
  useApp: mockUseApp,
}));

// Captured props from the mocked Dashboard
let capturedDashboardProps: any = null;

vi.mock('@/components/Dashboard', () => ({
  default: (props: any) => {
    capturedDashboardProps = props;
    return <div data-testid="dashboard" />;
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import after mocks are registered
// ---------------------------------------------------------------------------
const DashboardPage = (await import('@/app/page')).default;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DashboardPage', () => {
  const mockCluster = { id: 'cluster-1', name: 'production' };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedDashboardProps = null;
    mockUseApp.mockReturnValue({
      activeCluster: mockCluster,
      globalSearchQuery: 'nginx',
      setGlobalSearchQuery: mockSetGlobalSearchQuery,
      selectedNamespace: 'default',
      setSelectedNamespace: mockSetSelectedNamespace,
    });
  });

  it('renders Dashboard component', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  it('passes activeCluster from context to Dashboard', () => {
    render(<DashboardPage />);
    expect(capturedDashboardProps.activeCluster).toEqual(mockCluster);
  });

  it('passes searchQuery from context to Dashboard', () => {
    mockUseApp.mockReturnValue({
      activeCluster: null,
      globalSearchQuery: 'redis',
      setGlobalSearchQuery: vi.fn(),
      selectedNamespace: 'all',
      setSelectedNamespace: vi.fn(),
    });

    render(<DashboardPage />);
    expect(capturedDashboardProps.searchQuery).toBe('redis');
  });

  it('passes selectedNamespace from context to Dashboard', () => {
    mockUseApp.mockReturnValue({
      activeCluster: null,
      globalSearchQuery: '',
      setGlobalSearchQuery: vi.fn(),
      selectedNamespace: 'staging',
      setSelectedNamespace: vi.fn(),
    });

    render(<DashboardPage />);
    expect(capturedDashboardProps.selectedNamespace).toBe('staging');
  });

  it('passes onSearchQueryChange as setGlobalSearchQuery', () => {
    render(<DashboardPage />);
    expect(typeof capturedDashboardProps.onSearchQueryChange).toBe('function');
    capturedDashboardProps.onSearchQueryChange('new-query');
    expect(mockSetGlobalSearchQuery).toHaveBeenCalledWith('new-query');
  });

  it('passes onNamespaceChange as setSelectedNamespace', () => {
    render(<DashboardPage />);
    expect(typeof capturedDashboardProps.onNamespaceChange).toBe('function');
    capturedDashboardProps.onNamespaceChange('kube-system');
    expect(mockSetSelectedNamespace).toHaveBeenCalledWith('kube-system');
  });

  it('onSelectRelease navigates to /release/:namespace/:name', () => {
    render(<DashboardPage />);
    expect(typeof capturedDashboardProps.onSelectRelease).toBe('function');
    capturedDashboardProps.onSelectRelease('staging', 'my-app');
    expect(mockRouterPush).toHaveBeenCalledWith('/release/staging/my-app');
  });

  it('onBrowseCharts navigates to /charts', () => {
    render(<DashboardPage />);
    expect(typeof capturedDashboardProps.onBrowseCharts).toBe('function');
    capturedDashboardProps.onBrowseCharts();
    expect(mockRouterPush).toHaveBeenCalledWith('/charts');
  });
});
