import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted env – shared across all tests, mutated per-test
// ---------------------------------------------------------------------------
const env = vi.hoisted(() => ({ ...process.env }));

// ---------------------------------------------------------------------------
// Mock logger
// ---------------------------------------------------------------------------
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

// ---------------------------------------------------------------------------
// Mock next/server
// We need both `new NextResponse(...)` and `NextResponse.redirect(...)`.
// ---------------------------------------------------------------------------
const mockCookieSet = vi.fn();

vi.mock('next/server', () => {
  function MockNextResponse(body?: any, init?: any) {
    return { body, status: init?.status ?? 200, cookies: { set: mockCookieSet } };
  }
  MockNextResponse.redirect = vi.fn((url: string) => {
    return { body: null, status: 302, cookies: { set: mockCookieSet }, redirectedUrl: url };
  });

  return {
    NextRequest: vi.fn(),
    NextResponse: MockNextResponse,
  };
});

// ---------------------------------------------------------------------------
// Mock @/lib/oidc
// ---------------------------------------------------------------------------
const mockHandleCallback = vi.fn();
const mockFetchUserInfo = vi.fn();

vi.mock('@/lib/oidc', () => ({
  handleCallback: mockHandleCallback,
  fetchUserInfo: mockFetchUserInfo,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/session
// ---------------------------------------------------------------------------
const mockSetSession = vi.fn();

vi.mock('@/lib/session', () => ({
  setSession: mockSetSession,
}));

// ---------------------------------------------------------------------------
// Dynamic import after all mocks
// ---------------------------------------------------------------------------
const callbackRouteModule = () => import('@/app/api/auth/callback/route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setEnv(vars: Record<string, string | undefined>) {
  Object.entries(vars).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
}

function makeTokenSet(overrides: Record<string, any> = {}) {
  const { claims: claimsOverride, ...restOverrides } = overrides;
  return {
    claims: vi.fn().mockReturnValue({
      email: 'user@example.com',
      name: 'Test User',
      preferred_username: undefined,
      given_name: undefined,
      groups: ['developers', 'admins'],
      ...claimsOverride,
    }),
    id_token: 'id-token-abc',
    access_token: 'access-token-xyz',
    ...restOverrides,
  };
}

function makeRequest(overrides: Record<string, any> = {}) {
  return {
    cookies: {
      get: vi.fn().mockReturnValue(undefined),
      ...overrides.cookies,
    },
    nextUrl: {
      searchParams: new URLSearchParams(),
      ...overrides.nextUrl,
    },
    ...overrides,
  };
}

describe('GET /api/auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSetSession.mockResolvedValue({ cookies: { set: mockCookieSet }, status: 302 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // =========================================================================
  // OIDC not configured
  // =========================================================================
  describe('when OIDC is not configured', () => {
    it('returns 500 when OIDC_CLIENT_ID is missing', async () => {
      setEnv({ OIDC_CLIENT_ID: undefined, OIDC_CLIENT_SECRET: 'secret' });

      const { GET } = await callbackRouteModule();
      const request = makeRequest();
      const response = await GET(request as any);

      expect(response.status).toBe(500);
    });

    it('does not call handleCallback when OIDC_CLIENT_ID is missing', async () => {
      setEnv({ OIDC_CLIENT_ID: undefined, OIDC_CLIENT_SECRET: 'secret' });

      const { GET } = await callbackRouteModule();
      await GET(makeRequest() as any);

      expect(mockHandleCallback).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Successful callback with URL params
  // =========================================================================
  describe('successful callback with params', () => {
    beforeEach(() => {
      setEnv({
        OIDC_CLIENT_ID: 'my-client',
        OIDC_CLIENT_SECRET: 'my-secret',
        APP_URL: 'https://helm.example.com',
      });
      mockHandleCallback.mockResolvedValue(makeTokenSet());
    });

    it('calls handleCallback with redirectUri, params, and oidcState', async () => {
      const { GET } = await callbackRouteModule();

      const params = new URLSearchParams({ code: 'auth-code-123', state: 'state-456' });
      const request = makeRequest({
        cookies: {
          get: vi.fn().mockReturnValue({ value: 'cookie-state-789' }),
        },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockHandleCallback).toHaveBeenCalledTimes(1);
      expect(mockHandleCallback).toHaveBeenCalledWith(
        'https://helm.example.com/api/auth/callback',
        { code: 'auth-code-123', state: 'state-456' },
        'cookie-state-789',
      );
    });

    it('calls setSession with extracted user data from claims', async () => {
      const { GET } = await callbackRouteModule();

      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockSetSession).toHaveBeenCalledWith({
        email: 'user@example.com',
        name: 'Test User',
        token: 'id-token-abc',
        groups: ['developers', 'admins'],
      });
    });

    it('clears oidc_state cookie after setting session', async () => {
      const { GET } = await callbackRouteModule();

      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockCookieSet).toHaveBeenCalledWith('oidc_state', '', { maxAge: 0, path: '/' });
    });

    it('falls back to admin@example.com when claims have no email', async () => {
      mockHandleCallback.mockResolvedValue(makeTokenSet({
        claims: { email: undefined, name: undefined, groups: [] },
      }));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'admin@example.com', name: 'Administrator' }),
      );
    });

    it('uses preferred_username as name when name is missing', async () => {
      mockHandleCallback.mockResolvedValue(makeTokenSet({
        claims: { email: 'user@example.com', name: undefined, preferred_username: 'pref-user', groups: [] },
      }));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'pref-user' }),
      );
    });

    it('uses given_name as name when name and preferred_username are missing', async () => {
      mockHandleCallback.mockResolvedValue(makeTokenSet({
        claims: { email: 'user@example.com', name: undefined, preferred_username: undefined, given_name: 'Given', groups: [] },
      }));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Given' }),
      );
    });

    it('uses id_token as token when available', async () => {
      mockHandleCallback.mockResolvedValue(makeTokenSet({
        id_token: 'my-id-token',
        access_token: 'my-access-token',
      }));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'my-id-token' }),
      );
    });

    it('falls back to access_token when id_token is not available', async () => {
      mockHandleCallback.mockResolvedValue(makeTokenSet({
        id_token: undefined,
        access_token: 'access-only-token',
      }));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'access-only-token' }),
      );
    });
  });

  // =========================================================================
  // UserInfo fallback
  // =========================================================================
  describe('userinfo fallback when claims are default', () => {
    beforeEach(() => {
      setEnv({ OIDC_CLIENT_ID: 'my-client', OIDC_CLIENT_SECRET: 'my-secret' });
    });

    it('calls fetchUserInfo when email is admin@example.com and access_token exists', async () => {
      mockHandleCallback.mockResolvedValue(makeTokenSet({
        claims: { email: undefined, name: undefined, groups: [] },
        access_token: 'access-token-xyz',
      }));
      mockFetchUserInfo.mockResolvedValue({ email: 'real@example.com', name: 'Real User' });

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockFetchUserInfo).toHaveBeenCalledWith('access-token-xyz');
      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'real@example.com', name: 'Real User' }),
      );
    });

    it('logs a warning when fetchUserInfo fails', async () => {
      mockHandleCallback.mockResolvedValue(makeTokenSet({
        claims: { email: undefined, name: undefined, groups: [] },
        access_token: 'access-token-xyz',
      }));
      mockFetchUserInfo.mockRejectedValue(new Error('Network error'));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockLogger.warn).toHaveBeenCalledWith('Could not fetch userinfo');
      // Falls back to defaults
      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'admin@example.com' }),
      );
    });
  });

  // =========================================================================
  // OIDC_ALLOWED_GROUPS check
  // =========================================================================
  describe('OIDC_ALLOWED_GROUPS enforcement', () => {
    beforeEach(() => {
      setEnv({
        OIDC_CLIENT_ID: 'my-client',
        OIDC_CLIENT_SECRET: 'my-secret',
        OIDC_ALLOWED_GROUPS: 'platform-team, sre',
      });
      mockHandleCallback.mockResolvedValue(makeTokenSet());
    });

    it('returns 403 when user groups do not match allowed groups', async () => {
      mockHandleCallback.mockResolvedValue(makeTokenSet({
        claims: { email: 'user@example.com', groups: ['developers', 'qa'] },
      }));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      const response = await GET(request as any);
      expect(response.status).toBe(403);
    });

    it('does not call setSession when access is denied', async () => {
      mockHandleCallback.mockResolvedValue(makeTokenSet({
        claims: { email: 'user@example.com', groups: ['developers'] },
      }));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);
      expect(mockSetSession).not.toHaveBeenCalled();
    });

    it('allows access when user belongs to at least one allowed group (case-insensitive)', async () => {
      mockHandleCallback.mockResolvedValue(makeTokenSet({
        claims: { email: 'user@example.com', groups: ['Platform-Team', 'qa'] },
      }));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockSetSession).toHaveBeenCalled();
    });

    it('allows access when user group matches (case-insensitive comparison)', async () => {
      mockHandleCallback.mockResolvedValue(makeTokenSet({
        claims: { email: 'user@example.com', groups: ['SRE', 'qa'] },
      }));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockSetSession).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Callback failure
  // =========================================================================
  describe('callback failure', () => {
    beforeEach(() => {
      setEnv({ OIDC_CLIENT_ID: 'my-client', OIDC_CLIENT_SECRET: 'my-secret' });
    });

    it('returns 401 when handleCallback throws', async () => {
      mockHandleCallback.mockRejectedValue(new Error('Invalid grant'));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'bad-code' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      const response = await GET(request as any);
      expect(response.status).toBe(401);
    });

    it('logs error when handleCallback throws', async () => {
      mockHandleCallback.mockRejectedValue(new Error('Invalid grant'));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'bad-code' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'OIDC token exchange failed:',
        expect.any(Error),
      );
    });
  });

  // =========================================================================
  // No URL params (default admin fallback)
  // =========================================================================
  describe('no URL params', () => {
    beforeEach(() => {
      setEnv({ OIDC_CLIENT_ID: 'my-client', OIDC_CLIENT_SECRET: 'my-secret', OIDC_ALLOWED_GROUPS: undefined });
    });

    it('uses admin@example.com defaults when no URL params exist', async () => {
      const { GET } = await callbackRouteModule();
      const request = makeRequest();
      // nextUrl.searchParams is empty

      await GET(request as any);

      expect(mockHandleCallback).not.toHaveBeenCalled();
      expect(mockSetSession).toHaveBeenCalledWith({
        email: 'admin@example.com',
        name: 'Administrator',
        token: undefined,
        groups: [],
      });
    });

    it('still applies OIDC_ALLOWED_GROUPS check with empty groups', async () => {
      setEnv({
        OIDC_CLIENT_ID: 'my-client',
        OIDC_CLIENT_SECRET: 'my-secret',
        OIDC_ALLOWED_GROUPS: 'admins',
      });

      const { GET } = await callbackRouteModule();
      const request = makeRequest();

      const response = await GET(request as any);
      expect(response.status).toBe(403);
    });
  });

  // =========================================================================
  // APP_URL fallback
  // =========================================================================
  describe('APP_URL fallback', () => {
    it('uses localhost:3000 when APP_URL is not set', async () => {
      setEnv({
        OIDC_CLIENT_ID: 'my-client',
        OIDC_CLIENT_SECRET: 'my-secret',
        APP_URL: undefined,
      });
      mockHandleCallback.mockResolvedValue(makeTokenSet({ claims: { email: undefined, name: undefined, groups: [] } }));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockHandleCallback).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/callback',
        expect.any(Object),
        expect.any(String),
      );
    });

    it('strips trailing slash from APP_URL', async () => {
      setEnv({
        OIDC_CLIENT_ID: 'my-client',
        OIDC_CLIENT_SECRET: 'my-secret',
        APP_URL: 'https://helm.example.com/',
      });
      mockHandleCallback.mockResolvedValue(makeTokenSet({ claims: { email: undefined, name: undefined, groups: [] } }));

      const { GET } = await callbackRouteModule();
      const params = new URLSearchParams({ code: 'auth-code-123' });
      const request = makeRequest({
        cookies: { get: vi.fn().mockReturnValue({ value: 'state-abc' }) },
        nextUrl: { searchParams: params },
      });

      await GET(request as any);

      expect(mockHandleCallback).toHaveBeenCalledWith(
        'https://helm.example.com/api/auth/callback',
        expect.any(Object),
        expect.any(String),
      );
    });
  });
});
