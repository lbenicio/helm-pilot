import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock getSession from session.ts
// ---------------------------------------------------------------------------
const mockGetSession = vi.fn();

vi.mock('@/lib/session', () => ({
  getSession: mockGetSession,
}));

// ---------------------------------------------------------------------------
// Stub process.env helpers
// ---------------------------------------------------------------------------
function stubEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) {
      vi.stubEnv(k, undefined as any);
    } else {
      vi.stubEnv(k, v);
    }
  }
}

// ---------------------------------------------------------------------------
// Helper to create a fake NextRequest with headers.get()
// ---------------------------------------------------------------------------
function fakeRequest(headers?: Record<string, string | undefined>) {
  return {
    headers: {
      get: vi.fn().mockImplementation((name: string) => {
        if (headers && name in headers) return headers[name] ?? null;
        return null;
      }),
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
const k8sModule = () => import('@/lib/k8s');

describe('k8s — getK8sConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockGetSession.mockResolvedValue(null);
  });

  // -----------------------------------------------------------------------
  // apiUrl resolution
  // -----------------------------------------------------------------------
  it('returns null when no apiUrl is available (no header, no env var)', async () => {
    stubEnv({ K8S_API_URL: undefined, K8S_TOKEN: undefined });
    const { getK8sConfig } = await k8sModule();
    const req = fakeRequest();
    const result = await getK8sConfig(req);
    expect(result).toBeNull();
  });

  it('uses K8S_API_URL env var when header is missing', async () => {
    stubEnv({ K8S_API_URL: 'https://k8s.internal', K8S_TOKEN: 'svc-token' });
    const { getK8sConfig } = await k8sModule();
    const req = fakeRequest();
    const result = await getK8sConfig(req);
    expect(result).toMatchObject({ apiUrl: 'https://k8s.internal' });
  });

  it('prefers the x-k8s-api-url header over the env var', async () => {
    stubEnv({ K8S_API_URL: 'https://env-k8s', K8S_TOKEN: 'svc-token' });
    const { getK8sConfig } = await k8sModule();
    const req = fakeRequest({ 'x-k8s-api-url': 'https://header-k8s' });
    const result = await getK8sConfig(req);
    expect(result).toMatchObject({ apiUrl: 'https://header-k8s' });
  });

  // -----------------------------------------------------------------------
  // caCert resolution
  // -----------------------------------------------------------------------
  it('uses K8S_CA_CERT env var when header is missing', async () => {
    stubEnv({
      K8S_API_URL: 'https://k8s',
      K8S_CA_CERT: 'env-ca',
      K8S_TOKEN: 'tk',
    });
    const { getK8sConfig } = await k8sModule();
    const req = fakeRequest();
    const result = await getK8sConfig(req);
    expect(result).toMatchObject({ caCert: 'env-ca' });
  });

  it('prefers the x-k8s-ca-cert header over the env var', async () => {
    stubEnv({
      K8S_API_URL: 'https://k8s',
      K8S_CA_CERT: 'env-ca',
      K8S_TOKEN: 'tk',
    });
    const { getK8sConfig } = await k8sModule();
    const req = fakeRequest({ 'x-k8s-ca-cert': 'header-ca' });
    const result = await getK8sConfig(req);
    expect(result).toMatchObject({ caCert: 'header-ca' });
  });

  // -----------------------------------------------------------------------
  // Impersonation mode (K8S_TOKEN env var)
  // -----------------------------------------------------------------------
  it('enters impersonation mode when K8S_TOKEN is set', async () => {
    mockGetSession.mockResolvedValue({ email: 'user@corp.com', groups: ['devs'] });
    stubEnv({ K8S_API_URL: 'https://k8s', K8S_TOKEN: 'admin-token' });
    const { getK8sConfig } = await k8sModule();
    const req = fakeRequest();
    const result = await getK8sConfig(req);
    expect(result).toEqual({
      apiUrl: 'https://k8s',
      token: 'admin-token',
      caCert: undefined,
      impersonateUser: 'user@corp.com',
      impersonateGroups: ['devs'],
    });
  });

  it('impersonation mode still works when session returns null (no user)', async () => {
    mockGetSession.mockResolvedValue(null);
    stubEnv({ K8S_API_URL: 'https://k8s', K8S_TOKEN: 'admin-token' });
    const { getK8sConfig } = await k8sModule();
    const req = fakeRequest();
    const result = await getK8sConfig(req);
    expect(result).toEqual({
      apiUrl: 'https://k8s',
      token: 'admin-token',
      caCert: undefined,
      impersonateUser: undefined,
      impersonateGroups: undefined,
    });
  });

  it('impersonation mode includes caCert from header', async () => {
    mockGetSession.mockResolvedValue({ email: 'u@c.com' });
    stubEnv({ K8S_API_URL: 'https://k8s', K8S_TOKEN: 'tk' });
    const { getK8sConfig } = await k8sModule();
    const req = fakeRequest({ 'x-k8s-ca-cert': 'my-ca' });
    const result = await getK8sConfig(req);
    expect(result).toMatchObject({ caCert: 'my-ca', impersonateUser: 'u@c.com' });
  });

  // -----------------------------------------------------------------------
  // Normal mode (no K8S_TOKEN)
  // -----------------------------------------------------------------------
  it('uses the x-k8s-token header as the token in normal mode', async () => {
    stubEnv({ K8S_API_URL: 'https://k8s' });
    const { getK8sConfig } = await k8sModule();
    const req = fakeRequest({ 'x-k8s-token': 'header-token' });
    const result = await getK8sConfig(req);
    expect(result).toEqual({
      apiUrl: 'https://k8s',
      token: 'header-token',
      caCert: undefined,
    });
  });

  it('falls back to session token when x-k8s-token header is missing', async () => {
    mockGetSession.mockResolvedValue({ email: 'u@c.com', token: 'session-token' });
    stubEnv({ K8S_API_URL: 'https://k8s' });
    const { getK8sConfig } = await k8sModule();
    const req = fakeRequest();
    const result = await getK8sConfig(req);
    expect(result).toEqual({
      apiUrl: 'https://k8s',
      token: 'session-token',
      caCert: undefined,
    });
  });

  it('ignores the header token when its value is the string "undefined"', async () => {
    // When a header is sent with an empty/undefined value it may serialize to the literal "undefined"
    mockGetSession.mockResolvedValue({ email: 'u@c.com', token: 'session-fallback' });
    stubEnv({ K8S_API_URL: 'https://k8s' });
    const { getK8sConfig } = await k8sModule();
    const req = fakeRequest({ 'x-k8s-token': 'undefined' });
    const result = await getK8sConfig(req);
    expect(result).toEqual({
      apiUrl: 'https://k8s',
      token: 'session-fallback',
      caCert: undefined,
    });
  });

  it('returns null when no token is available in normal mode', async () => {
    mockGetSession.mockResolvedValue(null);
    stubEnv({ K8S_API_URL: 'https://k8s' });
    const { getK8sConfig } = await k8sModule();
    const req = fakeRequest();
    const result = await getK8sConfig(req);
    expect(result).toBeNull();
  });

  it('returns null when session returns user without a token', async () => {
    mockGetSession.mockResolvedValue({ email: 'u@c.com' }); // no token property
    stubEnv({ K8S_API_URL: 'https://k8s' });
    const { getK8sConfig } = await k8sModule();
    const req = fakeRequest();
    const result = await getK8sConfig(req);
    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // OIDC_SKIP_TLS_VERIFY side-effect
  // -----------------------------------------------------------------------
  it('sets NODE_TLS_REJECT_UNAUTHORIZED to "0" when OIDC_SKIP_TLS_VERIFY is "true"', async () => {
    // This is a module-level side effect that runs on import
    stubEnv({ OIDC_SKIP_TLS_VERIFY: 'true', K8S_API_URL: 'https://k8s', K8S_TOKEN: 'tk' });
    // Import triggers the side-effect
    await k8sModule();
    // NODE_TLS_REJECT_UNAUTHORIZED should be set by the module
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// callK8sApi tests
// ---------------------------------------------------------------------------
describe('k8s — callK8sApi', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubGlobal('fetch', mockFetch);
    stubEnv({ OIDC_SKIP_TLS_VERIFY: undefined as any });
  });

  function mockOkResponse(data: any) {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => data,
    });
  }

  function mockErrorResponse(status: number, body: string) {
    mockFetch.mockResolvedValue({
      ok: false,
      status,
      text: async () => body,
    });
  }

  // -----------------------------------------------------------------------
  // Non-impersonation path (no impersonateUser)
  // -----------------------------------------------------------------------
  it('makes a simple authenticated API call (non-impersonation)', async () => {
    const { callK8sApi } = await k8sModule();
    mockOkResponse({ items: [] });
    const config = { apiUrl: 'https://k8s.example.com', token: 'tk' };
    const result = await callK8sApi(config, '/api/v1/pods');
    expect(result).toEqual({ items: [] });
    expect(mockFetch).toHaveBeenCalledWith('https://k8s.example.com/api/v1/pods', {
      headers: { Authorization: 'Bearer tk', 'Content-Type': 'application/json' },
    });
  });

  it('merges custom options headers in non-impersonation path', async () => {
    const { callK8sApi } = await k8sModule();
    mockOkResponse({ done: true });
    const config = { apiUrl: 'https://k8s.example.com', token: 'tk' };
    const result = await callK8sApi(config, '/api/v1/pods', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/merge-patch+json', 'X-Custom': 'val' },
    });
    expect(result).toEqual({ done: true });
    expect(mockFetch).toHaveBeenCalledWith('https://k8s.example.com/api/v1/pods', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer tk',
        'Content-Type': 'application/merge-patch+json',
        'X-Custom': 'val',
      },
    });
  });

  it('throws on non-OK response in non-impersonation path', async () => {
    const { callK8sApi } = await k8sModule();
    mockErrorResponse(403, 'Forbidden');
    const config = { apiUrl: 'https://k8s.example.com', token: 'tk' };
    await expect(callK8sApi(config, '/api/v1/secrets')).rejects.toThrow('Kubernetes API error 403: Forbidden');
  });

  // -----------------------------------------------------------------------
  // Impersonation path (config.impersonateUser is set)
  // -----------------------------------------------------------------------
  it('sends impersonation headers when impersonateUser is set', async () => {
    const { callK8sApi } = await k8sModule();
    mockOkResponse({ items: [] });
    const config = { apiUrl: 'https://k8s.example.com', token: 'admin-tk', impersonateUser: 'user@corp.com' };
    await callK8sApi(config, '/api/v1/pods');
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://k8s.example.com/api/v1/pods');
    const headers: [string, string][] = callArgs[1].headers;
    expect(headers).toEqual(
      expect.arrayContaining([
        ['Authorization', 'Bearer admin-tk'],
        ['Content-Type', 'application/json'],
        ['Impersonate-User', 'user@corp.com'],
      ]),
    );
  });

  it('includes Impersonate-Group header when impersonateGroups is non-empty', async () => {
    const { callK8sApi } = await k8sModule();
    mockOkResponse({ items: [] });
    const config = {
      apiUrl: 'https://k8s.example.com',
      token: 'admin-tk',
      impersonateUser: 'user@corp.com',
      impersonateGroups: ['devs', 'admins'],
    };
    await callK8sApi(config, '/api/v1/pods');
    const headers: [string, string][] = mockFetch.mock.calls[0][1].headers;
    expect(headers).toEqual(
      expect.arrayContaining([
        ['Impersonate-User', 'user@corp.com'],
        ['Impersonate-Group', 'devs'],
      ]),
    );
    // Only the first group is sent
    const groupHeaders = headers.filter(([k]) => k === 'Impersonate-Group');
    expect(groupHeaders).toHaveLength(1);
    expect(groupHeaders[0][1]).toBe('devs');
  });

  it('does NOT add Impersonate-Group header when groups array is empty', async () => {
    const { callK8sApi } = await k8sModule();
    mockOkResponse({ items: [] });
    const config = {
      apiUrl: 'https://k8s.example.com',
      token: 'admin-tk',
      impersonateUser: 'user@corp.com',
      impersonateGroups: [],
    };
    await callK8sApi(config, '/api/v1/pods');
    const headers: [string, string][] = mockFetch.mock.calls[0][1].headers;
    expect(headers).toEqual(
      expect.arrayContaining([
        ['Impersonate-User', 'user@corp.com'],
      ]),
    );
    const groupHeaders = headers.filter(([k]) => k === 'Impersonate-Group');
    expect(groupHeaders).toHaveLength(0);
  });

  it('does NOT add Impersonate-Group header when groups is undefined', async () => {
    const { callK8sApi } = await k8sModule();
    mockOkResponse({ items: [] });
    const config = {
      apiUrl: 'https://k8s.example.com',
      token: 'admin-tk',
      impersonateUser: 'user@corp.com',
    };
    await callK8sApi(config, '/api/v1/pods');
    const headers: [string, string][] = mockFetch.mock.calls[0][1].headers;
    const groupHeaders = headers.filter(([k]) => k === 'Impersonate-Group');
    expect(groupHeaders).toHaveLength(0);
  });

  it('merges custom options headers in impersonation path', async () => {
    const { callK8sApi } = await k8sModule();
    mockOkResponse({ done: true });
    const config = { apiUrl: 'https://k8s.example.com', token: 'admin-tk', impersonateUser: 'u@c.com' };
    await callK8sApi(config, '/api/v1/pods', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/merge-patch+json', 'X-Custom': 'val' },
    });
    const headers: [string, string][] = mockFetch.mock.calls[0][1].headers;
    expect(headers).toEqual(
      expect.arrayContaining([
        ['Authorization', 'Bearer admin-tk'],
        ['Content-Type', 'application/merge-patch+json'],
        ['Impersonate-User', 'u@c.com'],
        ['X-Custom', 'val'],
      ]),
    );
  });

  it('throws on non-OK response in impersonation path', async () => {
    const { callK8sApi } = await k8sModule();
    mockErrorResponse(500, 'Internal Server Error');
    const config = { apiUrl: 'https://k8s.example.com', token: 'admin-tk', impersonateUser: 'u@c.com' };
    await expect(callK8sApi(config, '/api/v1/secrets')).rejects.toThrow('Kubernetes API error 500: Internal Server Error');
  });
});
