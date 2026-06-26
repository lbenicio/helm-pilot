import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRouterPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useParams: () => ({ namespace: 'staging', name: 'my-release' }),
}));

const mockUseApp = vi.fn();

vi.mock('@/contexts/AppContext', () => ({
  useApp: mockUseApp,
}));

let capturedReleaseDetailsProps: any = null;

vi.mock('@/components/ReleaseDetails', () => ({
  default: (props: any) => {
    capturedReleaseDetailsProps = props;
    return <div data-testid="release-details" />;
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import after mocks are registered
// ---------------------------------------------------------------------------
const ReleasePage = (await import('@/app/release/[namespace]/[name]/page')).default;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ReleasePage', () => {
  const mockCluster = { id: 'cluster-1', name: 'production' };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedReleaseDetailsProps = null;
    mockUseApp.mockReturnValue({
      activeCluster: mockCluster,
    });
  });

  it('renders ReleaseDetails component', () => {
    render(<ReleasePage />);
    expect(screen.getByTestId('release-details')).toBeInTheDocument();
  });

  it('passes name from URL params', () => {
    render(<ReleasePage />);
    expect(capturedReleaseDetailsProps.name).toBe('my-release');
  });

  it('passes namespace from URL params', () => {
    render(<ReleasePage />);
    expect(capturedReleaseDetailsProps.namespace).toBe('staging');
  });

  it('passes activeCluster from context', () => {
    render(<ReleasePage />);
    expect(capturedReleaseDetailsProps.activeCluster).toEqual(mockCluster);
  });

  it('onClose navigates to /', () => {
    render(<ReleasePage />);
    expect(typeof capturedReleaseDetailsProps.onClose).toBe('function');
    capturedReleaseDetailsProps.onClose();
    expect(mockRouterPush).toHaveBeenCalledWith('/');
  });

  it('onRefresh is a no-op function', () => {
    render(<ReleasePage />);
    expect(typeof capturedReleaseDetailsProps.onRefresh).toBe('function');
    expect(() => capturedReleaseDetailsProps.onRefresh()).not.toThrow();
  });

  it('renders correctly when activeCluster is null', () => {
    mockUseApp.mockReturnValue({ activeCluster: null });

    render(<ReleasePage />);
    expect(capturedReleaseDetailsProps.activeCluster).toBeNull();
  });
});
