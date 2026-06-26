import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @/lib/repos
// ---------------------------------------------------------------------------
const mockGetRepos = vi.fn();
const mockRemoveRepo = vi.fn();

vi.mock('@/lib/repos', () => ({
  getRepos: mockGetRepos,
  removeRepo: mockRemoveRepo,
}));

// ---------------------------------------------------------------------------
// Mock next/server
// ---------------------------------------------------------------------------
vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
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
const reposDeleteModule = () => import('@/app/api/repos/[name]/route');

describe('DELETE /api/repos/[name]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes a repo by name and returns success with remaining repos', async () => {
    const remainingRepos = [
      { name: 'prometheus', url: 'https://prometheus-community.github.io/helm-charts' },
    ];
    mockGetRepos.mockReturnValueOnce(remainingRepos);

    const { DELETE } = await reposDeleteModule();
    const response = (await DELETE({} as any, {
      params: Promise.resolve({ name: 'bitnami' }),
    })) as unknown as { body: Record<string, unknown>; status: number };

    expect(mockRemoveRepo).toHaveBeenCalledWith('bitnami');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      repos: remainingRepos,
    });
  });

  it('handles non-existent repo gracefully (no-op)', async () => {
    const currentRepos = [
      { name: 'stable', url: 'https://charts.helm.sh/stable' },
    ];
    mockGetRepos.mockReturnValueOnce(currentRepos);

    const { DELETE } = await reposDeleteModule();
    const response = (await DELETE({} as any, {
      params: Promise.resolve({ name: 'nonexistent' }),
    })) as unknown as { body: Record<string, unknown>; status: number };

    expect(mockRemoveRepo).toHaveBeenCalledWith('nonexistent');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      repos: currentRepos,
    });
  });

  it('returns empty repos array after deleting the last repo', async () => {
    mockGetRepos.mockReturnValueOnce([]);

    const { DELETE } = await reposDeleteModule();
    const response = (await DELETE({} as any, {
      params: Promise.resolve({ name: 'only-repo' }),
    })) as unknown as { body: Record<string, unknown>; status: number };

    expect(mockRemoveRepo).toHaveBeenCalledWith('only-repo');
    expect(response.body).toEqual({
      success: true,
      repos: [],
    });
  });

  it('awaits the params promise to extract the name', async () => {
    mockGetRepos.mockReturnValueOnce([]);
    let resolveParams: (value: { name: string }) => void;
    const paramsPromise = new Promise<{ name: string }>((resolve) => {
      resolveParams = resolve;
    });

    const { DELETE } = await reposDeleteModule();
    const responsePromise = DELETE({} as any, {
      params: paramsPromise,
    });

    // Delay resolution to verify the handler awaits
    resolveParams!({ name: 'delayed-repo' });
    await responsePromise;

    expect(mockRemoveRepo).toHaveBeenCalledWith('delayed-repo');
  });
});
