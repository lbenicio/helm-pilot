import * as oidc from 'openid-client';

import { logger } from './logger';

if (process.env.OIDC_SKIP_TLS_VERIFY === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  logger.info('OIDC TLS verification bypassed');
}

let cachedConfig: oidc.Configuration | null = null;

async function getConfig() {
  if (cachedConfig) return cachedConfig;
  const issuerUrl = process.env.OIDC_ISSUER_URL!;
  cachedConfig = await oidc.discovery(new URL(issuerUrl), process.env.OIDC_CLIENT_ID!, process.env.OIDC_CLIENT_SECRET);
  return cachedConfig;
}

export function generateState() {
  return oidc.randomState();
}

export async function getAuthorizationUrl(redirectUri: string, scope: string, state: string) {
  const config = await getConfig();
  return oidc.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope,
    state,
  });
}

export async function handleCallback(redirectUri: string, params: Record<string, string>, expectedState?: string) {
  const config = await getConfig();
  const tokenSet = await oidc.authorizationCodeGrant(config, new URL(`${redirectUri}?${new URLSearchParams(params)}`), {
    expectedState,
  });
  return tokenSet;
}

export async function fetchUserInfo(accessToken: string) {
  const config = await getConfig();
  return oidc.fetchUserInfo(config, accessToken, undefined);
}
