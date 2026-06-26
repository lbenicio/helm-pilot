import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks for jose and next/server
// ---------------------------------------------------------------------------
const mockJwtVerify = vi.fn();
const mockSign = vi.fn();
const mockCookieSet = vi.fn();

// SignJWT must be a constructor because the source does `new SignJWT(...)`.
// We use a regular function (not an arrow) so `new` works correctly.
function MockSignJWT(this: any, payload: any) {
  this.payload = payload;
  this.setProtectedHeader = vi.fn().mockReturnThis();
  this.setExpirationTime = vi.fn().mockReturnThis();
  this.sign = mockSign;
}

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
  SignJWT: MockSignJWT,
}));

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    redirect: vi.fn((url: string | URL) => ({
      url,
      status: 307,
      cookies: { set: mockCookieSet },
    })),
    json: vi.fn((body: any) => ({
      body,
      status: 200,
      cookies: { set: mockCookieSet },
    })),
  },
}));

// ---------------------------------------------------------------------------
// Helper to create a fake NextRequest with a cookies.get() method
// ---------------------------------------------------------------------------
function fakeRequest(cookieValue?: string, cookieName = 'helm_session') {
  return {
    cookies: {
      get: vi.fn().mockImplementation((name: string) =>
        name === cookieName && cookieValue != null ? { name, value: cookieValue } : undefined,
      ),
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Dynamic import after mocks are registered
// ---------------------------------------------------------------------------
const sessionModule = () => import('@/lib/session');

describe('session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // getSession
  // -----------------------------------------------------------------------
  describe('getSession', () => {
    it('returns the user payload when the JWT cookie is valid', async () => {
      const expectedUser = { email: 'a@b.com', name: 'Alice', token: 'tk' };
      mockJwtVerify.mockResolvedValueOnce({ payload: { user: expectedUser } });

      const { getSession } = await sessionModule();
      const req = fakeRequest('valid.jwt.token');
      const result = await getSession(req);

      expect(result).toEqual(expectedUser);
      expect(mockJwtVerify).toHaveBeenCalledTimes(1);
      expect(mockJwtVerify.mock.calls[0][0]).toBe('valid.jwt.token');
      expect(mockJwtVerify.mock.calls[0][1].constructor.name).toBe('Uint8Array');
    });

    it('returns null when the cookie is missing', async () => {
      const { getSession } = await sessionModule();
      const req = fakeRequest(undefined);
      const result = await getSession(req);
      expect(result).toBeNull();
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    it('returns null when jwtVerify rejects (e.g. expired / malformed token)', async () => {
      mockJwtVerify.mockRejectedValueOnce(new Error('JWT expired'));

      const { getSession } = await sessionModule();
      const req = fakeRequest('bad.token');
      const result = await getSession(req);
      expect(result).toBeNull();
    });

    it('returns null when jwtVerify throws synchronously', async () => {
      mockJwtVerify.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const { getSession } = await sessionModule();
      const req = fakeRequest('weird.token');
      const result = await getSession(req);
      expect(result).toBeNull();
    });

    it('returns the user even when optional fields (groups, token) are missing', async () => {
      const minimalUser = { email: 'min@test.com', name: 'Min' };
      mockJwtVerify.mockResolvedValueOnce({ payload: { user: minimalUser } });

      const { getSession } = await sessionModule();
      const req = fakeRequest('minimal.token');
      const result = await getSession(req);
      expect(result).toEqual(minimalUser);
    });
  });

  // -----------------------------------------------------------------------
  // setSession
  // -----------------------------------------------------------------------
  describe('setSession', () => {
    it('signs a JWT and returns a redirect response with the cookie set', async () => {
      mockSign.mockResolvedValueOnce('signed-jwt-here');

      const { setSession } = await sessionModule();
      const user = { email: 'u@x.com', name: 'Test', groups: ['admin'] };
      const res = await setSession(user);

      // Verify the JWT was signed with the user payload
      expect(mockSign).toHaveBeenCalled();

      // Verify redirect URL (defaults to localhost:3000 when APP_URL not set)
      expect(res.url).toBeInstanceOf(URL);
      expect(res.url.toString()).toContain('localhost:3000');

      // Verify the cookie was set correctly
      expect(mockCookieSet).toHaveBeenCalledWith(
        'helm_session',
        'signed-jwt-here',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24,
          path: '/',
        }),
      );
    });

    it('uses APP_URL when the environment variable is set', async () => {
      vi.stubEnv('APP_URL', 'https://helm.example.com');
      mockSign.mockResolvedValueOnce('jwt');

      const { setSession } = await sessionModule();
      const user = { email: 'e@e.com', name: 'E' };
      const res = await setSession(user);

      expect(res.url.toString()).toBe('https://helm.example.com/');

      vi.unstubAllEnvs();
    });

    it('sets secure: true when NODE_ENV is production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      mockSign.mockResolvedValueOnce('jwt');

      const { setSession } = await sessionModule();
      const user = { email: 'p@p.com', name: 'Prod' };
      await setSession(user);

      expect(mockCookieSet).toHaveBeenCalledWith(
        'helm_session',
        'jwt',
        expect.objectContaining({ secure: true }),
      );

      vi.unstubAllEnvs();
    });

    it('sets secure: false when NODE_ENV is not production', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      mockSign.mockResolvedValueOnce('jwt');

      const { setSession } = await sessionModule();
      const user = { email: 'd@d.com', name: 'Dev' };
      await setSession(user);

      expect(mockCookieSet).toHaveBeenCalledWith(
        'helm_session',
        'jwt',
        expect.objectContaining({ secure: false }),
      );

      vi.unstubAllEnvs();
    });
  });

  // -----------------------------------------------------------------------
  // clearSession
  // -----------------------------------------------------------------------
  describe('clearSession', () => {
    it('returns a JSON success response and clears the session cookie', async () => {
      const { clearSession } = await sessionModule();
      const res = clearSession();

      expect(res.body).toEqual({ success: true });
      expect(mockCookieSet).toHaveBeenCalledWith(
        'helm_session',
        '',
        { httpOnly: true, maxAge: 0, path: '/' },
      );
    });
  });
});
