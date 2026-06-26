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
