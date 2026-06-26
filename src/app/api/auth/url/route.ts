import { NextRequest, NextResponse } from 'next/server';
import { getOidcClient, generateState } from '@/lib/oidc';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  if (!process.env.OIDC_CLIENT_ID || !process.env.OIDC_CLIENT_SECRET) {
    return NextResponse.json({ error: 'OIDC not configured.' }, { status: 500 });
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/auth/callback`;

  try {
    const client = await getOidcClient(redirectUri);
    const scopes = (process.env.OIDC_SCOPES || 'openid profile email');
    const finalScopes = scopes.includes('openid') ? scopes : `openid ${scopes}`;
    const state = generateState();

    const authUrl = client.authorizationUrl({
      redirect_uri: redirectUri,
      scope: finalScopes,
      state,
    });

    logger.debug('[OIDC] Auth URL:', { redirectUri, clientId: process.env.OIDC_CLIENT_ID });

    const response = NextResponse.json({ url: authUrl, type: 'oidc' });
    response.cookies.set('oidc_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 min
      path: '/',
    });
    return response;
  } catch (e: any) {
    logger.error('OIDC auth URL failed:', e);
    return NextResponse.json({ error: 'OIDC negotiation failed.' }, { status: 500 });
  }
}
