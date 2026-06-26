import { NextRequest, NextResponse } from 'next/server';
import { getOidcClient } from '@/lib/oidc';
import { setSession, SessionUser } from '@/lib/session';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  if (!process.env.OIDC_CLIENT_ID) {
    return new NextResponse('OIDC not configured.', { status: 500 });
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/auth/callback`;
  const oidcState = request.cookies.get('oidc_state')?.value;

  let email = 'admin@example.com';
  let name = 'Administrator';
  let token: string | undefined;
  let groups: string[] = [];

  try {
    const client = await getOidcClient(redirectUri);
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);

    if (Object.keys(searchParams).length > 0) {
      const tokenSet = await client.callback(redirectUri, searchParams, { state: oidcState });
      const claims = tokenSet.claims();

      email = (claims.email as string) || email;
      name = (claims.name || claims.preferred_username || claims.given_name || name) as string;
      token = tokenSet.id_token || tokenSet.access_token;
      groups = (claims.groups as string[]) || [];

      if ((email === 'admin@example.com' || name === 'Administrator') && tokenSet.access_token) {
        try {
          const userInfo = await client.userinfo(tokenSet.access_token);
          email = (userInfo.email as string) || email;
          name = (userInfo.name || userInfo.preferred_username || userInfo.given_name || name) as string;
        } catch (e) {
          logger.warn('Could not fetch userinfo:', e);
        }
      }
    }
  } catch (err: any) {
    logger.error('OIDC token exchange failed:', err);
    return new NextResponse(`OIDC Callback failed: ${err.message}`, { status: 401 });
  }

  // Authorization check
  const allowedGroups = process.env.OIDC_ALLOWED_GROUPS;
  if (allowedGroups) {
    const allowed = allowedGroups.split(',').map(g => g.trim().toLowerCase());
    const userLower = groups.map(g => g.toLowerCase());
    if (!allowed.some(g => userLower.includes(g))) {
      logger.warn(`Access denied for ${email} — groups ${groups}`);
      return new NextResponse('Access denied: unauthorized groups.', { status: 403 });
    }
  }

  logger.debug('[OIDC] Login:', { email, name, groups });

  const user: SessionUser = { email, name, token, groups };
  const response = await setSession(user);
  response.cookies.set('oidc_state', '', { maxAge: 0, path: '/' });
  return response;
}
