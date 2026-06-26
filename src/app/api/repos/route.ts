import { NextResponse } from 'next/server';

import { getRepos } from '@/lib/repos';

export async function GET() {
  return NextResponse.json(getRepos());
}
