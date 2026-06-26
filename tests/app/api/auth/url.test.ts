import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock next/server
// ---------------------------------------------------------------------------
const mockCookieSet = vi.fn();

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: vi.fn((body: any, init?: any) => ({
      body,
      status: init?.status ?? 200,
      cookies: { set: mockCookieSet },
    })),
  },
}));

// ---------------------------------------------------------------------------
// Mock @/lib/logger
// ---------------------------------------------------------------------------
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock @/lib/oidc – generateState and getAuthorizationUrl
// ---------------------------------------------------------------------------
const mockGenerateState = vi.fn();
const mockGetAuthorizationUrl = vi.fn();

vi.mock('@/lib/oidc', () => ({
  generateState: mockGenerateState,
  getAuthorizationUrl: mockGetAuthorizationUrl,
}));

// ---------------------------------------------------------------------------
// Dynamic import after mocks are registered
// ---------------------------------------------------------------------------
const urlRouteModule = () => import('@/app/api/auth/url/route');

// Helper to reset environment for each test
function setOidcEnv(vars: Record<string, string | undefined>) {
  Object.entries(vars).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
}

describe('GET /api/auth/url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // -----------------------------------------------------------------------
  // Error: missing OIDC_CLIENT_ID
  // -----------------------------------------------------------------------
  describe('when OIDC is not configured', () => {
    it('returns 500 when OIDC_CLIENT_ID is missing', async () => {
      setOidcEnv({
        OIDC_CLIENT_ID: undefined,
        OIDC_CLIENT_SECRET: 'secret',
      });

      const { GET } = await urlRouteModule();
      const response = await GET({} as any);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'OIDC not configured.' });
    });

    it('returns 500 when OIDC_CLIENT_SECRET is missing', async () => {
      setOidcEnv({
        OIDC_CLIENT_ID: 'client-id',
        OIDC_CLIENT_SECRET: undefined,
      });

      const { GET } = await urlRouteModule();
      const response = await GET({} as any);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'OIDC not configured.' });
    });

    it('returns 500 when both OIDC_CLIENT_ID and OIDC_CLIENT_SECRET are missing', async () => {
      setOidcEnv({
        OIDC_CLIENT_ID: undefined,
        OIDC_CLIENT_SECRET: undefined,
      });

      const { GET } = await urlRouteModule();
      const response = await GET({} as any);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'OIDC not configured.' });
    });

    it('does not call generateState or getAuthorizationUrl when not configured', async () => {
      setOidcEnv({
        OIDC_CLIENT_ID: undefined,
        OIDC_CLIENT_SECRET: 'secret',
      });

      const { GET } = await urlRouteModule();
      await GET({} as any);

      expect(mockGenerateState).not.toHaveBeenCalled();
      expect(mockGetAuthorizationUrl).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Success: OIDC configured
  // -----------------------------------------------------------------------
  describe('when OIDC is configured', () => {
    beforeEach(() => {
      setOidcEnv({
        OIDC_CLIENT_ID: 'my-client-id',
        OIDC_CLIENT_SECRET: 'my-client-secret',
        OIDC_SCOPES: undefined,
        APP_URL: undefined,
        NODE_ENV: undefined,
      });
      mockGenerateState.mockReturnValue('random-state-123');
      mockGetAuthorizationUrl.mockResolvedValue('https://oidc.example.com/authorize?client_id=...');
    });

    it('returns an auth URL with type oidc', async () => {
      const { GET } = await urlRouteModule();
      const response = await GET({} as any);

      expect(response.body).toEqual({
        url: 'https://oidc.example.com/authorize?client_id=...',
        type: 'oidc',
      });
      expect(response.status).toBe(200);
    });

    it('calls generateState to create a state value', async () => {
      const { GET } = await urlRouteModule();
      await GET({} as any);

      expect(mockGenerateState).toHaveBeenCalledTimes(1);
    });

    it('calls getAuthorizationUrl with redirect URI, scopes, and state', async () => {
      const { GET } = await urlRouteModule();
      await GET({} as any);

      expect(mockGetAuthorizationUrl).toHaveBeenCalledTimes(1);
      expect(mockGetAuthorizationUrl).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/callback',
        'openid profile email',
        'random-state-123',
      );
    });

    it('sets the oidc_state cookie with httpOnly, sameSite, path, and maxAge', async () => {
      const { GET } = await urlRouteModule();
      await GET({} as any);

      expect(mockCookieSet).toHaveBeenCalledTimes(1);
      expect(mockCookieSet).toHaveBeenCalledWith(
        'oidc_state',
        'random-state-123',
        expect.objectContaining({
          httpOnly: true,
          secure: false, // NODE_ENV is not production
          sameSite: 'lax',
          maxAge: 600,
          path: '/',
        }),
      );
    });

    // -------------------------------------------------------------------
    // OIDC_SCOPES variations
    // -------------------------------------------------------------------
    it('uses default scopes "openid profile email" when OIDC_SCOPES is not set', async () => {
      setOidcEnv({
        OIDC_CLIENT_ID: 'client',
        OIDC_CLIENT_SECRET: 'secret',
        OIDC_SCOPES: undefined,
      });

      const { GET } = await urlRouteModule();
      await GET({} as any);

      expect(mockGetAuthorizationUrl).toHaveBeenCalledWith(
        expect.any(String),
        'openid profile email',
        expect.any(String),
      );
    });

    it('prepends "openid" to scopes when missing from custom OIDC_SCOPES', async () => {
      setOidcEnv({
        OIDC_CLIENT_ID: 'client',
        OIDC_CLIENT_SECRET: 'secret',
        OIDC_SCOPES: 'profile email groups',
      });

      // Need fresh import because env is read at module load time
      vi.resetModules();
      const { GET } = await urlRouteModule();
      await GET({} as any);

      expect(mockGetAuthorizationUrl).toHaveBeenCalledWith(
        expect.any(String),
        'openid profile email groups',
        expect.any(String),
      );
    });

    it('does not duplicate "openid" when already present in OIDC_SCOPES', async () => {
      setOidcEnv({
        OIDC_CLIENT_ID: 'client',
        OIDC_CLIENT_SECRET: 'secret',
        OIDC_SCOPES: 'openid profile email',
      });

      vi.resetModules();
      const { GET } = await urlRouteModule();
      await GET({} as any);

      expect(mockGetAuthorizationUrl).toHaveBeenCalledWith(
        expect.any(String),
        'openid profile email',
        expect.any(String),
      );
    });

    // -------------------------------------------------------------------
    // APP_URL variations
    // -------------------------------------------------------------------
    it('uses APP_URL for the redirect URI when set', async () => {
      setOidcEnv({
        OIDC_CLIENT_ID: 'client',
        OIDC_CLIENT_SECRET: 'secret',
        APP_URL: 'https://helm.example.com',
      });

      vi.resetModules();
      const { GET } = await urlRouteModule();
      await GET({} as any);

      expect(mockGetAuthorizationUrl).toHaveBeenCalledWith(
        'https://helm.example.com/api/auth/callback',
        expect.any(String),
        expect.any(String),
      );
    });

    it('strips trailing slash from APP_URL before building redirect URI', async () => {
      setOidcEnv({
        OIDC_CLIENT_ID: 'client',
        OIDC_CLIENT_SECRET: 'secret',
        APP_URL: 'https://helm.example.com/',
      });

      vi.resetModules();
      const { GET } = await urlRouteModule();
      await GET({} as any);

      expect(mockGetAuthorizationUrl).toHaveBeenCalledWith(
        'https://helm.example.com/api/auth/callback',
        expect.any(String),
        expect.any(String),
      );
    });

    it('falls back to localhost:3000 when APP_URL is not set', async () => {
      setOidcEnv({
        OIDC_CLIENT_ID: 'client',
        OIDC_CLIENT_SECRET: 'secret',
        APP_URL: undefined,
      });

      vi.resetModules();
      const { GET } = await urlRouteModule();
      await GET({} as any);

      expect(mockGetAuthorizationUrl).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/callback',
        expect.any(String),
        expect.any(String),
      );
    });

    // -------------------------------------------------------------------
    // secure cookie flag
    // -------------------------------------------------------------------
    it('sets secure: true on the cookie when NODE_ENV is production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      setOidcEnv({
        OIDC_CLIENT_ID: 'client',
        OIDC_CLIENT_SECRET: 'secret',
      });
      mockCookieSet.mockClear();

      const { GET } = await urlRouteModule();
      await GET({} as any);

      expect(mockCookieSet).toHaveBeenCalledWith(
        'oidc_state',
        expect.any(String),
        expect.objectContaining({ secure: true }),
      );
    });

    it('sets secure: false on the cookie when NODE_ENV is not production', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      setOidcEnv({
        OIDC_CLIENT_ID: 'client',
        OIDC_CLIENT_SECRET: 'secret',
      });
      mockCookieSet.mockClear();

      const { GET } = await urlRouteModule();
      await GET({} as any);

      expect(mockCookieSet).toHaveBeenCalledWith(
        'oidc_state',
        expect.any(String),
        expect.objectContaining({ secure: false }),
      );
    });
  });
});
