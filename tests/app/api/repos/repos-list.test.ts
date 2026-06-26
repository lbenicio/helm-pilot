import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @/lib/repos
// ---------------------------------------------------------------------------
const mockGetRepos = vi.fn();

vi.mock('@/lib/repos', () => ({
  getRepos: mockGetRepos,
}));

// ---------------------------------------------------------------------------
// Mock next/server
// ---------------------------------------------------------------------------
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import after mocks are registered
// ---------------------------------------------------------------------------
const reposListModule = () => import('@/app/api/repos/route');

describe('GET /api/repos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the repos array from getRepos()', async () => {
    const repos = [
      { name: 'stable', url: 'https://charts.helm.sh/stable' },
    ];
    mockGetRepos.mockReturnValueOnce(repos);

    const { GET } = await reposListModule();
    const response = (await GET()) as unknown as { body: unknown[]; status: number };

    expect(response.status).toBe(200);
    expect(response.body).toEqual(repos);
  });

  it('returns an empty array when no repos exist', async () => {
    mockGetRepos.mockReturnValueOnce([]);

    const { GET } = await reposListModule();
    const response = (await GET()) as unknown as { body: unknown[]; status: number };

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('returns multiple repos after adds', async () => {
    const repos = [
      { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' },
      { name: 'prometheus', url: 'https://prometheus-community.github.io/helm-charts' },
      { name: 'grafana', url: 'https://grafana.github.io/helm-charts' },
    ];
    mockGetRepos.mockReturnValueOnce(repos);

    const { GET } = await reposListModule();
    const response = (await GET()) as unknown as { body: unknown[]; status: number };

    expect(response.body).toHaveLength(3);
    expect(response.body).toEqual(repos);
  });
});
