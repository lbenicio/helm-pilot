import { jwtVerify, SignJWT } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_SECRET = new TextEncoder().encode(process.env.SESSION_SECRET || 'helm-pilot-session-secret-key-2024');

export interface SessionUser {
  email: string;
  name: string;
  token?: string;
  groups?: string[];
}

export async function getSession(request: NextRequest): Promise<SessionUser | null> {
  const cookie = request.cookies.get('helm_session');
  if (!cookie) return null;
  try {
    const { payload } = await jwtVerify(cookie.value, SESSION_SECRET);
    return payload.user as SessionUser;
  } catch {
    return null;
  }
}

export async function setSession(user: SessionUser): Promise<NextResponse> {
  const token = await new SignJWT({ user }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('24h').sign(SESSION_SECRET);

  const response = NextResponse.redirect(new URL('/', process.env.APP_URL || 'http://localhost:3000'));
  response.cookies.set('helm_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24h
    path: '/',
  });
  return response;
}

export function clearSession(): NextResponse {
  const response = NextResponse.json({ success: true });
  response.cookies.set('helm_session', '', { httpOnly: true, maxAge: 0, path: '/' });
  return response;
}
