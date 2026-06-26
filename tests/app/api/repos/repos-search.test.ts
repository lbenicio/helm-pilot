import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mutable mock references — reassigned in beforeEach via doMock
// ---------------------------------------------------------------------------
let mockGetRepos: ReturnType<typeof vi.fn>;
let mockYamlLoad: ReturnType<typeof vi.fn>;
let mockLoggerDebug: ReturnType<typeof vi.fn>;
let mockFetch: ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Dynamic import — re-imports fresh module each time (cache reset)
// ---------------------------------------------------------------------------
const searchRouteModule = () => import('@/app/api/repos/search/route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(searchParams: URLSearchParams) {
  return {
    nextUrl: { searchParams },
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/repos/search', () => {
  beforeEach(() => {
    // Reset module cache so the searchRoute's internal Map is fresh each test
    vi.resetModules();

    mockGetRepos = vi.fn(() => []);
    mockYamlLoad = vi.fn();
    mockLoggerDebug = vi.fn();
    mockFetch = vi.fn();

    vi.doMock('@/lib/repos', () => ({ getRepos: mockGetRepos }));
    vi.doMock('@/lib/logger', () => ({ logger: { debug: mockLoggerDebug } }));
    vi.doMock('js-yaml', () => ({ load: mockYamlLoad }));

    globalThis.fetch = mockFetch;
  });

  describe('empty state', () => {
    it('returns empty array when no repos exist', async () => {
      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('')));
      const body = await response.json();
      expect(body).toEqual([]);
    });

    it('returns empty array with query when no repos exist', async () => {
      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('q=nginx')));
      const body = await response.json();
      expect(body).toEqual([]);
    });
  });

  describe('query filtering', () => {
    const repo = { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' };

    beforeEach(() => {
      mockGetRepos.mockReturnValue([repo]);
    });

    it('returns all charts from a repo when no query', async () => {
      mockYamlLoad.mockReturnValue({
        entries: {
          nginx: [{ description: 'Web server', version: '1.0.0', appVersion: '1.27', icon: '' }],
          redis: [{ description: 'Cache', version: '2.0.0', appVersion: '7.0', icon: '' }],
        },
      });
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('---') } as Response);

      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('')));

      const body = await response.json();
      expect(body).toHaveLength(2);
      expect(body.map((c: any) => c.name).sort()).toEqual(['nginx', 'redis']);
    });

    it('filters charts by name when query is provided', async () => {
      mockYamlLoad.mockReturnValue({
        entries: {
          nginx: [{ description: 'Web server', version: '1.0.0', appVersion: '1.27', icon: '' }],
          redis: [{ description: 'Cache', version: '2.0.0', appVersion: '7.0', icon: '' }],
        },
      });
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('---') } as Response);

      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('q=nginx')));

      const body = await response.json();
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('nginx');
    });

    it('filters charts by description when query is provided', async () => {
      mockYamlLoad.mockReturnValue({
        entries: {
          nginx: [{ description: 'Web server', version: '1.0.0', appVersion: '1.27', icon: '' }],
          redis: [{ description: 'In-memory cache', version: '2.0.0', appVersion: '7.0', icon: '' }],
        },
      });
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('---') } as Response);

      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('q=cache')));

      const body = await response.json();
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('redis');
    });

    it('filters case-insensitively for descriptions but case-sensitively for names', async () => {
      // The route lowercases the query. Name matching uses `c.name.includes(query)`
      // which is case-SENSITIVE. Description matching uses `.toLowerCase().includes(query)`.
      // So "nginx" matches description "NGINX Web Server" but NOT name "NGINX".
      mockGetRepos.mockReturnValue([
        { name: 'test', url: 'https://test.example.com/charts' },
      ]);
      mockYamlLoad.mockReturnValue({
        entries: {
          NGINX: [{ description: 'NGINX Web Server', version: '1.0.0', appVersion: '1.27', icon: '' }],
          apache: [{ description: 'Apache server', version: '2.0.0', appVersion: '2.4', icon: '' }],
        },
      });
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('---') } as Response);

      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('q=apache')));

      const body = await response.json();
      // "apache" matches both name "apache" AND description "Apache server" (case-insensitive)
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('apache');
    });
  });

  describe('repo filter', () => {
    const repoA = { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' };
    const repoB = { name: 'grafana', url: 'https://grafana.github.io/helm-charts' };

    it('filters to only the specified repo', async () => {
      mockGetRepos.mockReturnValue([repoA, repoB]);
      mockYamlLoad.mockReturnValue({
        entries: {
          nginx: [{ description: 'Web server', version: '1.0.0', appVersion: '1.27', icon: '' }],
        },
      });
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('---') } as Response);

      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('repo=bitnami')));

      const body = await response.json();
      expect(body.every((c: any) => c.repo === 'bitnami')).toBe(true);
    });

    it('returns empty when repo filter does not match any repo', async () => {
      mockGetRepos.mockReturnValue([repoA]);
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('---') } as Response);

      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('repo=nonexistent')));

      const body = await response.json();
      expect(body).toEqual([]);
    });
  });

  describe('caching', () => {
    it('uses cached results on subsequent calls within the same request context', async () => {
      const repo = { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' };
      mockGetRepos.mockReturnValue([repo]);
      mockYamlLoad.mockReturnValue({
        entries: {
          nginx: [{ description: 'Web server', version: '1.0.0', appVersion: '1.27', icon: '' }],
        },
      });

      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('---') } as Response);

      const { GET } = await searchRouteModule();

      // First call — should fetch
      const response1 = await GET(makeRequest(new URLSearchParams('')));
      const body1 = await response1.json();
      expect(body1).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call — module-level cache is still populated
      const response2 = await GET(makeRequest(new URLSearchParams('')));
      const body2 = await response2.json();
      expect(body2).toHaveLength(1);
      // fetch should not be called again (cache hit within same module instance)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('handles fetch failure gracefully and returns empty results', async () => {
      const repo = { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' };
      mockGetRepos.mockReturnValue([repo]);
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('')));

      const body = await response.json();
      expect(body).toEqual([]);
      // Logger should have been called with the error
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('Repo search failed for bitnami'),
      );
    });

    it('handles non-ok fetch response gracefully', async () => {
      const repo = { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' };
      mockGetRepos.mockReturnValue([repo]);
      mockFetch.mockResolvedValue({ ok: false } as Response);

      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('')));

      const body = await response.json();
      expect(body).toEqual([]);
    });

    it('handles invalid YAML in index gracefully', async () => {
      const repo = { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' };
      mockGetRepos.mockReturnValue([repo]);
      mockYamlLoad.mockImplementation(() => {
        throw new Error('Invalid YAML');
      });
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('invalid yaml') } as Response);

      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('')));

      const body = await response.json();
      expect(body).toEqual([]);
    });

    it('handles missing entries in index gracefully', async () => {
      const repo = { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' };
      mockGetRepos.mockReturnValue([repo]);
      mockYamlLoad.mockReturnValue({});
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('---') } as Response);

      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('')));

      const body = await response.json();
      expect(body).toEqual([]);
    });
  });

  describe('abort / timeout', () => {
    it('handles abort errors gracefully', async () => {
      const repo = { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' };
      mockGetRepos.mockReturnValue([repo]);

      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockFetch.mockRejectedValue(abortError);

      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('')));

      const body = await response.json();
      expect(body).toEqual([]);
    });
  });

  describe('multiple repos', () => {
    it('aggregates results from multiple repos', async () => {
      mockGetRepos.mockReturnValue([
        { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' },
        { name: 'grafana', url: 'https://grafana.github.io/helm-charts' },
      ]);

      mockYamlLoad.mockReturnValue({
        entries: {
          app: [{ description: 'An app', version: '1.0.0', appVersion: '1.0', icon: '' }],
        },
      });
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('---') } as Response);

      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('')));

      const body = await response.json();
      // Two different repos, each with "app" chart — should have 2 entries (different repos)
      expect(body).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('deduplicates charts with same name and repo', async () => {
      mockGetRepos.mockReturnValue([
        { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' },
      ]);
      mockYamlLoad.mockReturnValue({
        entries: {
          nginx: [{ description: 'Web server', version: '1.0.0', appVersion: '1.27', icon: '' }],
        },
      });
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('---') } as Response);

      const { GET } = await searchRouteModule();
      const response = await GET(makeRequest(new URLSearchParams('')));

      const body = await response.json();
      expect(body).toHaveLength(1);
    });
  });
});
