import { describe, expect, it } from 'vitest';

import sitemap from '@/app/sitemap';

describe('sitemap', () => {
  it('returns an array of sitemap entries', () => {
    const result = sitemap();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes the homepage with priority 1', () => {
    const result = sitemap();
    const home = result.find((entry) => entry.url.endsWith('/') && !entry.url.endsWith('/charts') && !entry.url.endsWith('/events') && !entry.url.endsWith('/health') && !entry.url.endsWith('/search'));
    // Home entry is the one whose path is just the base URL
    const homeEntry = result.find((entry) => {
      const url = new URL(entry.url);
      return url.pathname === '/' || url.pathname === '';
    });
    expect(homeEntry).toBeDefined();
    expect(homeEntry!.priority).toBe(1);
  });

  it('includes /charts page with priority 0.8', () => {
    const result = sitemap();
    const charts = result.find((entry) => entry.url.endsWith('/charts'));
    expect(charts).toBeDefined();
    expect(charts!.priority).toBe(0.8);
  });

  it('includes /events page with priority 0.6', () => {
    const result = sitemap();
    const events = result.find((entry) => entry.url.endsWith('/events'));
    expect(events).toBeDefined();
    expect(events!.priority).toBe(0.6);
  });

  it('includes /health page with priority 0.6', () => {
    const result = sitemap();
    const health = result.find((entry) => entry.url.endsWith('/health'));
    expect(health).toBeDefined();
    expect(health!.priority).toBe(0.6);
  });

  it('includes /search page with priority 0.5', () => {
    const result = sitemap();
    const search = result.find((entry) => entry.url.endsWith('/search'));
    expect(search).toBeDefined();
    expect(search!.priority).toBe(0.5);
  });

  it('every entry has a changeFrequency of daily', () => {
    const result = sitemap();
    result.forEach((entry) => {
      expect(entry.changeFrequency).toBe('daily');
    });
  });

  it('every entry has a lastModified date', () => {
    const result = sitemap();
    result.forEach((entry) => {
      expect(entry.lastModified).toBeInstanceOf(Date);
    });
  });

  it('returns exactly 5 pages', () => {
    const result = sitemap();
    expect(result).toHaveLength(5);
  });

  it('all URLs are absolute', () => {
    const result = sitemap();
    result.forEach((entry) => {
      expect(entry.url.startsWith('http://') || entry.url.startsWith('https://')).toBe(true);
    });
  });
});
