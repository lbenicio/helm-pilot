import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { generateState, getAuthorizationUrl } from '@/lib/oidc';

export async function GET(_request: NextRequest) {
  if (!process.env.OIDC_CLIENT_ID || !process.env.OIDC_CLIENT_SECRET) {
    return NextResponse.json({ error: 'OIDC not configured.' }, { status: 500 });
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/auth/callback`;
  const scopes = process.env.OIDC_SCOPES || 'openid profile email';
  const finalScopes = scopes.includes('openid') ? scopes : `openid ${scopes}`;
  const state = generateState();

  const authUrl = await getAuthorizationUrl(redirectUri, finalScopes, state);

  logger.debug('[OIDC] Auth URL:', { redirectUri, clientId: process.env.OIDC_CLIENT_ID });

  const response = NextResponse.json({ url: authUrl, type: 'oidc' });
  response.cookies.set('oidc_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
