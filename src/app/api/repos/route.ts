import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const { getRepos } = await import('@/lib/repos');
  return NextResponse.json(getRepos());
}

export async function POST(request: NextRequest) {
  const { name, url } = await request.json();
  if (!name || !url) return NextResponse.json({ error: 'name and url required' }, { status: 400 });
  const { addRepo, getRepos } = await import('@/lib/repos');
  if (!addRepo({ name, url: url.replace(/\/$/, '') })) {
    return NextResponse.json({ error: 'Repo already exists' }, { status: 400 });
  }
  return NextResponse.json({ success: true, repos: getRepos() });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const name = url.pathname.split('/').pop() || '';
  const { removeRepo, getRepos } = await import('@/lib/repos');
  removeRepo(name);
  return NextResponse.json({ success: true, repos: getRepos() });
}
