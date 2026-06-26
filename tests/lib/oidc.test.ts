import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock logger so we can assert that `info` was called on TLS bypass
// ---------------------------------------------------------------------------
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock openid-client – we do this *before* importing oidc.ts so the
// top-level `if (process.env.OIDC_SKIP_TLS_VERIFY …)` block sees the
// mocked logger.
// ---------------------------------------------------------------------------
const mockDiscovery = vi.fn();
const mockBuildAuthorizationUrl = vi.fn();
const mockAuthorizationCodeGrant = vi.fn();
const mockRandomState = vi.fn();
const mockFetchUserInfo = vi.fn();

vi.mock('openid-client', () => ({
  discovery: mockDiscovery,
  buildAuthorizationUrl: mockBuildAuthorizationUrl,
  authorizationCodeGrant: mockAuthorizationCodeGrant,
  randomState: mockRandomState,
  fetchUserInfo: mockFetchUserInfo,
}));

// We need to reset module state between tests so cachedConfig is fresh
// and the top-level TLS check re-evaluates.
const oidcModule = () => import('@/lib/oidc');

describe('oidc lib', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset cachedConfig by forcing a fresh module import each time
    vi.resetModules();
    // Restore NODE_TLS_REJECT_UNAUTHORIZED so TLS-bypass tests are independent
    delete process.env.OIDC_SKIP_TLS_VERIFY;
    delete process.env.OIDC_CLIENT_SECRET;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
  });

  afterEach(() => {
    delete process.env.OIDC_SKIP_TLS_VERIFY;
    delete process.env.OIDC_CLIENT_SECRET;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
  });

  // -----------------------------------------------------------------------
  // TLS bypass
  // -----------------------------------------------------------------------
  it('sets NODE_TLS_REJECT_UNAUTHORIZED to "0" when OIDC_SKIP_TLS_VERIFY is "true"', async () => {
    process.env.OIDC_SKIP_TLS_VERIFY = 'true';
    // Restore to a known value first
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

    await oidcModule();

    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe('0');
  });

  it('logs info when TLS verification is bypassed', async () => {
    const { logger } = await import('@/lib/logger');
    process.env.OIDC_SKIP_TLS_VERIFY = 'true';

    await oidcModule();

    expect(logger.info).toHaveBeenCalledWith('OIDC TLS verification bypassed');
  });

  it('does NOT alter NODE_TLS_REJECT_UNAUTHORIZED when OIDC_SKIP_TLS_VERIFY is not "true"', async () => {
    process.env.OIDC_SKIP_TLS_VERIFY = 'false';
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

    await oidcModule();

    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe('1');
  });

  it('leaves NODE_TLS_REJECT_UNAUTHORIZED unchanged when OIDC_SKIP_TLS_VERIFY is unset', async () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

    await oidcModule();

    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe('1');
  });

  // -----------------------------------------------------------------------
  // generateState
  // -----------------------------------------------------------------------
  it('generateState returns a string from randomState', async () => {
    mockRandomState.mockReturnValue('random-state-abc');

    const { generateState } = await oidcModule();
    const result = generateState();

    expect(result).toBe('random-state-abc');
    expect(mockRandomState).toHaveBeenCalledOnce();
  });

  it('generateState returns whatever randomState returns (including empty string)', async () => {
    mockRandomState.mockReturnValue('');

    const { generateState } = await oidcModule();
    const result = generateState();

    expect(result).toBe('');
  });

  // -----------------------------------------------------------------------
  // getAuthorizationUrl
  // -----------------------------------------------------------------------
  it('getAuthorizationUrl returns the URL string from buildAuthorizationUrl', async () => {
    process.env.OIDC_ISSUER_URL = 'https://auth.example.com';
    process.env.OIDC_CLIENT_ID = 'test-client';
    process.env.OIDC_CLIENT_SECRET = 'secret';

    const mockConfig = { issuer: 'https://auth.example.com' };
    mockDiscovery.mockResolvedValue(mockConfig);
    mockBuildAuthorizationUrl.mockReturnValue('https://auth.example.com/authorize?response_type=code');

    const { getAuthorizationUrl } = await oidcModule();
    const url = await getAuthorizationUrl('https://app.example.com/cb', 'openid profile', 'state123');

    expect(url).toBe('https://auth.example.com/authorize?response_type=code');
    expect(mockDiscovery).toHaveBeenCalledWith(
      new URL('https://auth.example.com'),
      'test-client',
      'secret',
    );
    expect(mockBuildAuthorizationUrl).toHaveBeenCalledWith(mockConfig, {
      redirect_uri: 'https://app.example.com/cb',
      scope: 'openid profile',
      state: 'state123',
    });
  });

  // -----------------------------------------------------------------------
  // config caching
  // -----------------------------------------------------------------------
  it('caches the OIDC config so discovery is only called once', async () => {
    process.env.OIDC_ISSUER_URL = 'https://auth.example.com';
    process.env.OIDC_CLIENT_ID = 'test-client';
    process.env.OIDC_CLIENT_SECRET = 'secret';

    const mockConfig = { issuer: 'https://auth.example.com' };
    mockDiscovery.mockResolvedValue(mockConfig);
    mockBuildAuthorizationUrl.mockReturnValue('https://auth.example.com/authorize');

    const mod = await oidcModule();

    await mod.getAuthorizationUrl('https://cb1', 'openid', 's1');
    await mod.getAuthorizationUrl('https://cb2', 'profile', 's2');
    await mod.getAuthorizationUrl('https://cb3', 'email', 's3');

    // Discovery should only be invoked once despite three getAuthorizationUrl calls.
    expect(mockDiscovery).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // handleCallback
  // -----------------------------------------------------------------------
  it('handleCallback returns a tokenSet via authorizationCodeGrant', async () => {
    process.env.OIDC_ISSUER_URL = 'https://auth.example.com';
    process.env.OIDC_CLIENT_ID = 'test-client';
    process.env.OIDC_CLIENT_SECRET = 'secret';

    const mockConfig = { issuer: 'https://auth.example.com' };
    const mockTokenSet = { access_token: 'at-123', id_token: 'id-456' };
    mockDiscovery.mockResolvedValue(mockConfig);
    mockAuthorizationCodeGrant.mockResolvedValue(mockTokenSet);

    const { handleCallback } = await oidcModule();
    const result = await handleCallback(
      'https://app.example.com/cb',
      { code: 'auth-code', state: 'st' },
      'st',
    );

    expect(result).toEqual(mockTokenSet);
    expect(mockAuthorizationCodeGrant).toHaveBeenCalledOnce();

    // Verify the second argument is a URL built from redirectUri + params
    const callArgs = mockAuthorizationCodeGrant.mock.calls[0];
    expect(callArgs[0]).toBe(mockConfig);
    expect(callArgs[1].href).toContain('https://app.example.com/cb?');
    expect(callArgs[1].href).toContain('code=auth-code');
    expect(callArgs[1].href).toContain('state=st');
    expect(callArgs[2]).toEqual({ expectedState: 'st' });
  });

  it('handleCallback works without expectedState (undefined)', async () => {
    process.env.OIDC_ISSUER_URL = 'https://auth.example.com';
    process.env.OIDC_CLIENT_ID = 'test-client';
    process.env.OIDC_CLIENT_SECRET = 'secret';

    const mockConfig = { issuer: 'https://auth.example.com' };
    mockDiscovery.mockResolvedValue(mockConfig);
    mockAuthorizationCodeGrant.mockResolvedValue({ access_token: 'at' });

    const { handleCallback } = await oidcModule();
    const result = await handleCallback('https://app.example.com/cb', { code: 'c' });

    expect(result).toEqual({ access_token: 'at' });
    expect(mockAuthorizationCodeGrant.mock.calls[0][2]).toEqual({ expectedState: undefined });
  });

  // -----------------------------------------------------------------------
  // fetchUserInfo
  // -----------------------------------------------------------------------
  it('fetchUserInfo calls openid-client fetchUserInfo with correct arguments', async () => {
    process.env.OIDC_ISSUER_URL = 'https://auth.example.com';
    process.env.OIDC_CLIENT_ID = 'test-client';
    process.env.OIDC_CLIENT_SECRET = 'secret';

    const mockConfig = { issuer: 'https://auth.example.com' };
    const mockUserInfo = { sub: 'user-1', email: 'user@example.com' };
    mockDiscovery.mockResolvedValue(mockConfig);
    mockFetchUserInfo.mockResolvedValue(mockUserInfo);

    const { fetchUserInfo } = await oidcModule();
    const result = await fetchUserInfo('access-token-xyz');

    expect(result).toEqual(mockUserInfo);
    expect(mockFetchUserInfo).toHaveBeenCalledWith(mockConfig, 'access-token-xyz', undefined);
  });
});
