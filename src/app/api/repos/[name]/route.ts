import { NextRequest, NextResponse } from 'next/server';

import { getRepos, removeRepo } from '@/lib/repos';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  removeRepo(name);
  return NextResponse.json({ success: true, repos: getRepos() });
}
