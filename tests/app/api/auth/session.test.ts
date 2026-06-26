import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock next/server
// ---------------------------------------------------------------------------
const mockCookieSet = vi.fn();

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: vi.fn((body: any) => ({
      body,
      status: 200,
      cookies: { set: mockCookieSet },
    })),
  },
}));

// ---------------------------------------------------------------------------
// Mock @/lib/session
// ---------------------------------------------------------------------------
const mockGetSession = vi.fn();

vi.mock('@/lib/session', () => ({
  getSession: mockGetSession,
}));

// ---------------------------------------------------------------------------
// Dynamic import after mocks are registered
// ---------------------------------------------------------------------------
const sessionRouteModule = () => import('@/app/api/auth/session/route');

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns authenticated user when session exists', async () => {
    const user = { email: 'user@example.com', name: 'Test User', token: 'abc123' };
    mockGetSession.mockResolvedValueOnce(user);

    const { GET } = await sessionRouteModule();
    const response = await GET({} as any);

    expect(response.body).toEqual({
      email: 'user@example.com',
      name: 'Test User',
      authenticated: true,
    });
  });

  it('returns { authenticated: false } when session is null', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const { GET } = await sessionRouteModule();
    const response = await GET({} as any);

    expect(response.body).toEqual({ authenticated: false });
  });

  it('returns { authenticated: false } when session is undefined', async () => {
    mockGetSession.mockResolvedValueOnce(undefined);

    const { GET } = await sessionRouteModule();
    const response = await GET({} as any);

    expect(response.body).toEqual({ authenticated: false });
  });

  it('calls getSession with the request object', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const fakeRequest = { cookies: { get: vi.fn() } };

    const { GET } = await sessionRouteModule();
    await GET(fakeRequest as any);

    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockGetSession).toHaveBeenCalledWith(fakeRequest);
  });

  it('returns only email and name from the session (not token)', async () => {
    const user = { email: 'a@b.com', name: 'A', token: 'secret-token', groups: ['admin'] };
    mockGetSession.mockResolvedValueOnce(user);

    const { GET } = await sessionRouteModule();
    const response = await GET({} as any);

    expect(response.body).toEqual({
      email: 'a@b.com',
      name: 'A',
      authenticated: true,
    });
    // Token and groups should NOT be leaked to the client
    expect(response.body).not.toHaveProperty('token');
    expect(response.body).not.toHaveProperty('groups');
  });
});
