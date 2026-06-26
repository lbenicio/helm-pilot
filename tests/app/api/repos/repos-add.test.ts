import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @/lib/repos
// ---------------------------------------------------------------------------
const mockGetRepos = vi.fn();
const mockAddRepo = vi.fn();

vi.mock('@/lib/repos', () => ({
  getRepos: mockGetRepos,
  addRepo: mockAddRepo,
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
const reposAddModule = () => import('@/app/api/repos/add/route');

function mockRequest(data: any): any {
  return {
    json: async () => data,
  };
}

describe('POST /api/repos/add', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully adds a repo and returns updated list', async () => {
    const repos = [
      { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' },
    ];
    mockAddRepo.mockReturnValueOnce(true);
    mockGetRepos.mockReturnValueOnce(repos);

    const { POST } = await reposAddModule();
    const response = (await POST(
      mockRequest({ name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' }),
    )) as unknown as { body: Record<string, unknown>; status: number };

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, repos });
    expect(mockAddRepo).toHaveBeenCalledWith({
      name: 'bitnami',
      url: 'https://charts.bitnami.com/bitnami',
    });
  });

  it('returns 400 when name is missing', async () => {
    const { POST } = await reposAddModule();
    const response = (await POST(
      mockRequest({ url: 'https://charts.bitnami.com/bitnami' }),
    )) as unknown as { body: Record<string, unknown>; status: number };

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'name and url required' });
    expect(mockAddRepo).not.toHaveBeenCalled();
  });

  it('returns 400 when url is missing', async () => {
    const { POST } = await reposAddModule();
    const response = (await POST(
      mockRequest({ name: 'bitnami' }),
    )) as unknown as { body: Record<string, unknown>; status: number };

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'name and url required' });
    expect(mockAddRepo).not.toHaveBeenCalled();
  });

  it('returns 400 when both name and url are missing', async () => {
    const { POST } = await reposAddModule();
    const response = (await POST(
      mockRequest({}),
    )) as unknown as { body: Record<string, unknown>; status: number };

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'name and url required' });
    expect(mockAddRepo).not.toHaveBeenCalled();
  });

  it('returns 400 when addRepo returns false (duplicate repo)', async () => {
    mockAddRepo.mockReturnValueOnce(false);

    const { POST } = await reposAddModule();
    const response = (await POST(
      mockRequest({ name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' }),
    )) as unknown as { body: Record<string, unknown>; status: number };

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Repo already exists' });
    expect(mockAddRepo).toHaveBeenCalledWith({
      name: 'bitnami',
      url: 'https://charts.bitnami.com/bitnami',
    });
  });

  it('strips trailing slash from the URL', async () => {
    mockAddRepo.mockReturnValueOnce(true);
    mockGetRepos.mockReturnValueOnce([]);

    const { POST } = await reposAddModule();
    await POST(
      mockRequest({ name: 'stable', url: 'https://charts.helm.sh/stable/' }),
    );

    expect(mockAddRepo).toHaveBeenCalledWith({
      name: 'stable',
      url: 'https://charts.helm.sh/stable',
    });
  });

  it('does not modify URLs without trailing slash', async () => {
    mockAddRepo.mockReturnValueOnce(true);
    mockGetRepos.mockReturnValueOnce([]);

    const { POST } = await reposAddModule();
    await POST(
      mockRequest({ name: 'stable', url: 'https://charts.helm.sh/stable' }),
    );

    expect(mockAddRepo).toHaveBeenCalledWith({
      name: 'stable',
      url: 'https://charts.helm.sh/stable',
    });
  });

  it('only strips the last trailing slash', async () => {
    mockAddRepo.mockReturnValueOnce(true);
    mockGetRepos.mockReturnValueOnce([]);

    const { POST } = await reposAddModule();
    await POST(
      mockRequest({ name: 'test', url: 'https://charts.example.com/path/to/repo/' }),
    );

    expect(mockAddRepo).toHaveBeenCalledWith({
      name: 'test',
      url: 'https://charts.example.com/path/to/repo',
    });
  });
});
