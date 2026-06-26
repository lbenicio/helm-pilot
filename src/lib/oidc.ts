import { Issuer, generators, BaseClient } from 'openid-client';
import { logger } from './logger';

// Apply TLS bypass if configured (for self-signed OIDC providers)
if (process.env.OIDC_SKIP_TLS_VERIFY === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  logger.info('OIDC TLS verification bypassed');
}

let cachedIssuer: Issuer<BaseClient> | null = null;

export async function getOidcClient(redirectUri: string) {
  const issuerUrl = process.env.OIDC_ISSUER_URL!;
  if (!cachedIssuer) {
    cachedIssuer = await Issuer.discover(issuerUrl);
  }
  return new cachedIssuer.Client({
    client_id: process.env.OIDC_CLIENT_ID!,
    client_secret: process.env.OIDC_CLIENT_SECRET!,
    redirect_uris: [redirectUri],
    response_types: ['code'],
  });
}

export function generateState() {
  return generators.state();
}
