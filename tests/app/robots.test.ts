import { describe, expect, it } from 'vitest';

import robots from '@/app/robots';

describe('robots', () => {
  it('returns allow rule for /', () => {
    const result = robots();
    expect(result.rules.allow).toBe('/');
  });

  it('returns disallow rules for /api/ and /auth/', () => {
    const result = robots();
    expect(result.rules.disallow).toEqual(['/api/', '/auth/']);
  });

  it('returns userAgent as *', () => {
    const result = robots();
    expect(result.rules.userAgent).toBe('*');
  });

  it('returns a sitemap URL', () => {
    const result = robots();
    expect(result.sitemap).toBeDefined();
    expect(result.sitemap).toContain('sitemap.xml');
  });

  it('sitemap URL ends with /sitemap.xml', () => {
    const result = robots();
    expect(result.sitemap!.endsWith('/sitemap.xml')).toBe(true);
  });
});
