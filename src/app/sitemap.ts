import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL || 'http://localhost:3000';

  const pages = [
    { path: '', priority: 1 },
    { path: '/charts', priority: 0.8 },
    { path: '/events', priority: 0.6 },
    { path: '/health', priority: 0.6 },
    { path: '/search', priority: 0.5 },
  ];

  return pages.map(({ path, priority }) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority,
  }));
}
