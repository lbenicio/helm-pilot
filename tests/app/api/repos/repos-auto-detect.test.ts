import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetK8sConfig = vi.fn();
const mockCallK8sApi = vi.fn();
const mockGetRepos = vi.fn(() => []);
const mockParseHelmSecret = vi.fn();

vi.mock('@/lib/k8s', () => ({
  getK8sConfig: mockGetK8sConfig,
  callK8sApi: mockCallK8sApi,
}));

vi.mock('@/lib/repos', () => ({
  getRepos: mockGetRepos,
}));

vi.mock('@/lib/helm', () => ({
  parseHelmSecret: mockParseHelmSecret,
}));

const mockYamlLoad = vi.fn();

vi.mock('js-yaml', () => ({
  load: mockYamlLoad,
}));

// ---------------------------------------------------------------------------
// Dynamic import after mocks are registered
// ---------------------------------------------------------------------------
const autoDetectRouteModule = () => import('@/app/api/repos/auto-detect/route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockFetchOk(body: string) {
  return Promise.resolve({
    ok: true,
    text: () => Promise.resolve(body),
  } as Response);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('POST /api/repos/auto-detect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRepos.mockReturnValue([]);
    mockYamlLoad.mockReset();
    globalThis.fetch = vi.fn();
  });

  describe('authentication', () => {
    it('returns 401 when K8s config is null', async () => {
      mockGetK8sConfig.mockResolvedValue(null);

      const { POST } = await autoDetectRouteModule();
      const response = await POST({} as any);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({ error: 'Kubernetes Cluster Authentication is required.' });
    });
  });

  describe('successful auto-detect', () => {
    const config = { apiUrl: 'https://k8s.example.com', token: 'token', caCert: '' };

    it('detects repos from helm secrets and returns added repos', async () => {
      mockGetK8sConfig.mockResolvedValue(config);
      mockCallK8sApi.mockResolvedValue({
        items: [
          { data: { release: 'base64data1' } },
          { data: { release: 'base64data2' } },
        ],
      });

      // Two secrets: one for nginx (bitnami), one for loki (grafana)
      mockParseHelmSecret
        .mockResolvedValueOnce({ chart: { metadata: { name: 'nginx' } } })
        .mockResolvedValueOnce({ chart: { metadata: { name: 'loki' } } });

      // bitnami index contains nginx
      mockYamlLoad.mockReturnValueOnce({
        entries: { nginx: [{ description: 'nginx', version: '1.0.0' }] },
      });
      // The other known repos don't have matching charts, so they won't be added
      // but grafana index should contain loki
      mockYamlLoad.mockReturnValueOnce({ entries: {} });           // prometheus-community
      mockYamlLoad.mockReturnValueOnce({ entries: { loki: [{ description: 'loki', version: '2.0.0' }] } }); // grafana

      (globalThis.fetch as any).mockResolvedValue(mockFetchOk('---'));

      const { POST } = await autoDetectRouteModule();
      const response = await POST({} as any);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.added).toContain('bitnami');
      expect(body.added).toContain('grafana');
      expect(body.repos).toHaveLength(2);
    });

    it('skips repos already in the repos list', async () => {
      mockGetK8sConfig.mockResolvedValue(config);
      mockCallK8sApi.mockResolvedValue({
        items: [{ data: { release: 'base64data1' } }],
      });
      mockParseHelmSecret.mockResolvedValue({ chart: { metadata: { name: 'nginx' } } });

      // bitnami is already in repos
      mockGetRepos.mockReturnValue([
        { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' },
      ]);

      // No other known repo should match nginx, so nothing added
      // But we match bitnami first, which is skipped
      mockYamlLoad.mockReturnValue({ entries: {} });

      (globalThis.fetch as any).mockResolvedValue(mockFetchOk('---'));

      const { POST } = await autoDetectRouteModule();
      const response = await POST({} as any);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.added).toEqual([]);
    });
  });

  describe('empty secret list', () => {
    it('returns success with no added repos when no helm secrets exist', async () => {
      const config = { apiUrl: 'https://k8s.example.com', token: 'token', caCert: '' };
      mockGetK8sConfig.mockResolvedValue(config);
      mockCallK8sApi.mockResolvedValue({ items: [] });

      (globalThis.fetch as any).mockResolvedValue(mockFetchOk('---'));

      const { POST } = await autoDetectRouteModule();
      const response = await POST({} as any);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.added).toEqual([]);
    });
  });

  describe('error handling', () => {
    const config = { apiUrl: 'https://k8s.example.com', token: 'token', caCert: '' };

    it('handles secrets without release data gracefully', async () => {
      mockGetK8sConfig.mockResolvedValue(config);
      mockCallK8sApi.mockResolvedValue({
        items: [
          { data: {} }, // no release field
          { data: { release: 'base64data1' } },
        ],
      });
      mockParseHelmSecret.mockResolvedValue({ chart: { metadata: { name: 'nginx' } } });

      mockYamlLoad.mockReturnValue({ entries: { nginx: [{}] } });
      (globalThis.fetch as any).mockResolvedValue(mockFetchOk('---'));

      const { POST } = await autoDetectRouteModule();
      const response = await POST({} as any);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.added).toContain('bitnami');
    });

    it('handles parseHelmSecret errors gracefully', async () => {
      mockGetK8sConfig.mockResolvedValue(config);
      mockCallK8sApi.mockResolvedValue({
        items: [{ data: { release: 'bad-data' } }],
      });
      mockParseHelmSecret.mockRejectedValue(new Error('Parse error'));

      (globalThis.fetch as any).mockResolvedValue(mockFetchOk('---'));

      const { POST } = await autoDetectRouteModule();
      const response = await POST({} as any);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.added).toEqual([]);
    });

    it('handles fetch timeout for known repo index', async () => {
      mockGetK8sConfig.mockResolvedValue(config);
      mockCallK8sApi.mockResolvedValue({
        items: [{ data: { release: 'base64data1' } }],
      });
      mockParseHelmSecret.mockResolvedValue({ chart: { metadata: { name: 'nginx' } } });

      // The known repos loop will try to fetch each one; simulate fetch rejections
      (globalThis.fetch as any).mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

      const { POST } = await autoDetectRouteModule();
      const response = await POST({} as any);

      const body = await response.json();
      expect(body.success).toBe(true);
      // No repos should be added since all fetches fail
      expect(body.added).toEqual([]);
    });

    it('handles non-ok fetch responses for known repos', async () => {
      mockGetK8sConfig.mockResolvedValue(config);
      mockCallK8sApi.mockResolvedValue({
        items: [{ data: { release: 'base64data1' } }],
      });
      mockParseHelmSecret.mockResolvedValue({ chart: { metadata: { name: 'nginx' } } });

      (globalThis.fetch as any).mockResolvedValue({
        ok: false,
      } as Response);

      const { POST } = await autoDetectRouteModule();
      const response = await POST({} as any);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.added).toEqual([]);
    });

    it('returns 500 when callK8sApi throws', async () => {
      mockGetK8sConfig.mockResolvedValue(config);
      mockCallK8sApi.mockRejectedValue(new Error('K8s API unavailable'));

      const { POST } = await autoDetectRouteModule();
      const response = await POST({} as any);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: 'K8s API unavailable' });
    });
  });
});
