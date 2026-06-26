import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock next/server
// ---------------------------------------------------------------------------
const mockCookieSet = vi.fn();

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: any) => ({
      body,
      status: 200,
      cookies: { set: mockCookieSet },
    })),
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import after mocks are registered
// ---------------------------------------------------------------------------
const logoutModule = () => import('@/app/api/auth/logout/route');

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { success: true }', async () => {
    const { POST } = await logoutModule();
    const response = await POST();

    expect(response.body).toEqual({ success: true });
  });

  it('clears the helm_session cookie with maxAge 0', async () => {
    const { POST } = await logoutModule();
    await POST();

    expect(mockCookieSet).toHaveBeenCalledTimes(1);
    expect(mockCookieSet).toHaveBeenCalledWith(
      'helm_session',
      '',
      { httpOnly: true, maxAge: 0, path: '/' },
    );
  });

  it('returns HTTP 200 status', async () => {
    const { POST } = await logoutModule();
    const response = await POST();

    expect(response.status).toBe(200);
  });

  it('sets the cookie as httpOnly', async () => {
    const { POST } = await logoutModule();
    await POST();

    const callArgs = mockCookieSet.mock.calls[0][2];
    expect(callArgs.httpOnly).toBe(true);
  });

  it('sets the cookie path to /', async () => {
    const { POST } = await logoutModule();
    await POST();

    const callArgs = mockCookieSet.mock.calls[0][2];
    expect(callArgs.path).toBe('/');
  });
});
