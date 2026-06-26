import * as yaml from 'js-yaml';
import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getRepos } from '@/lib/repos';

const searchCache = new Map<string, { charts: any[]; fetchedAt: number }>();

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get('q') || '').toLowerCase();
  const repoFilter = request.nextUrl.searchParams.get('repo') || '';
  const activeRepos = repoFilter ? getRepos().filter((r) => r.name === repoFilter) : getRepos();
  const results: any[] = [];

  await Promise.allSettled(
    activeRepos.map(async (repo) => {
      try {
        const cacheKey = repo.url;
        const cached = searchCache.get(cacheKey);
        if (cached && Date.now() - cached.fetchedAt < 600000) {
          cached.charts.forEach((c) => {
            if (query && !c.name.includes(query) && !c.description?.toLowerCase().includes(query)) return;
            if (!results.some((r) => r.name === c.name && r.repo === repo.name)) {
              results.push({ ...c, repo: repo.name });
            }
          });
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const resp = await fetch(`${repo.url}/index.yaml`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!resp.ok) return;

        const text = await resp.text();
        const index = yaml.load(text) as any;
        if (!index?.entries) return;

        const repoCharts: any[] = [];
        Object.entries(index.entries).forEach(([name, entries]: [string, any]) => {
          if (!entries?.length) return;
          const latest = entries[0];
          repoCharts.push({
            name,
            description: latest.description || '',
            version: latest.version || '',
            appVersion: latest.appVersion || '',
            icon: latest.icon || '',
          });
        });

        searchCache.set(cacheKey, { charts: repoCharts, fetchedAt: Date.now() });
        repoCharts.forEach((c) => {
          if (query && !c.name.includes(query) && !c.description?.toLowerCase().includes(query)) return;
          results.push({ ...c, repo: repo.name });
        });
      } catch (e: any) {
        logger.debug(`Repo search failed for ${repo.name}: ${e.message}`);
      }
    }),
  );

  return NextResponse.json(results);
}
