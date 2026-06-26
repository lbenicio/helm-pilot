import { NextRequest, NextResponse } from 'next/server';

import { addRepo, getRepos } from '@/lib/repos';

export async function POST(request: NextRequest) {
  const { name, url } = await request.json();
  if (!name || !url) return NextResponse.json({ error: 'name and url required' }, { status: 400 });
  if (!addRepo({ name, url: url.replace(/\/$/, '') })) {
    return NextResponse.json({ error: 'Repo already exists' }, { status: 400 });
  }
  return NextResponse.json({ success: true, repos: getRepos() });
}
