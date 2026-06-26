import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (session) {
    return NextResponse.json({ email: session.email, name: session.name, authenticated: true });
  }
  return NextResponse.json({ authenticated: false });
}
