import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock factories – vitest hoists vi.mock calls, so these run before imports
// ---------------------------------------------------------------------------
const mockNextResponseJson = vi.fn(
  (body: any, init?: { status?: number }) => ({
    body,
    status: init?.status ?? 200,
    json: async () => body,
  }),
);

vi.mock('@/lib/k8s', () => ({
  getK8sConfig: vi.fn(),
  callK8sApi: vi.fn(),
}));

vi.mock('@/lib/helm', () => ({
  encodeHelmRelease: vi.fn(),
  parseHelmSecret: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: { json: mockNextResponseJson },
}));

// ---------------------------------------------------------------------------
// Now import mocked modules + the route handlers
// ---------------------------------------------------------------------------

import { encodeHelmRelease, parseHelmSecret } from '@/lib/helm';
import { callK8sApi, getK8sConfig } from '@/lib/k8s';

// ---------------------------------------------------------------------------
// Dynamically import the route so vi.mock hoisting applies cleanly
// ---------------------------------------------------------------------------
const routeModule = () => import('@/app/api/k8s/[...path]/route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockParams(pathParts: string[]) {
  return { params: Promise.resolve({ path: pathParts }) };
}

function mockGetRequest(
  opts: {
    searchParams?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.searchParams || {})) sp.set(k, v);
  return {
    method: 'GET',
    headers: {
      get: vi.fn((name: string) => opts.headers?.[name] ?? null),
    },
    nextUrl: { searchParams: sp },
  } as any;
}

function mockPostRequest(
  body: any,
  opts: { searchParams?: Record<string, string> } = {},
) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.searchParams || {})) sp.set(k, v);
  return {
    method: 'POST',
    headers: {
      get: vi.fn(() => null),
    },
    nextUrl: { searchParams: sp },
    json: vi.fn().mockResolvedValue(body),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('k8s proxy routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNextResponseJson.mockClear();
  });

  // -------------------------------------------------------------------
  // Auth guard
  // -------------------------------------------------------------------
  it('returns 401 when no cluster config is available', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue(null);
    const { GET } = await routeModule();
    const res = (await GET(mockGetRequest(), mockParams(['test']))) as any;
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Kubernetes Cluster Authentication is required.' });
  });

  // -------------------------------------------------------------------
  // GET /test
  // -------------------------------------------------------------------
  it('GET /test returns success with clusterName and namespaces', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });
    vi.mocked(callK8sApi).mockResolvedValue({
      items: [
        { metadata: { name: 'default' } },
        { metadata: { name: 'kube-system' } },
      ],
    });

    const { GET } = await routeModule();
    const res = (await GET(mockGetRequest(), mockParams(['test']))) as any;
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      namespaces: ['default', 'kube-system'],
    });
  });

  // -------------------------------------------------------------------
  // GET /cluster-health
  // -------------------------------------------------------------------
  it('GET /cluster-health returns health data with nodes and components', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });
    vi.mocked(callK8sApi).mockImplementation(async (_config, path) => {
      if (path === '/api/v1/nodes') {
        return {
          items: [
            {
              metadata: {
                name: 'node1',
                labels: { 'node-role.kubernetes.io/control-plane': 'true' },
              },
              status: {
                conditions: [{ type: 'Ready', status: 'True' }],
                capacity: { cpu: '4', memory: '16Gi' },
              },
            },
            {
              metadata: {
                name: 'node2',
                labels: {},
              },
              status: {
                conditions: [{ type: 'Ready', status: 'True' }],
                capacity: { cpu: '2', memory: '8Gi' },
              },
            },
          ],
        };
      }
      if (path === '/api/v1/componentstatuses') {
        return { items: [] };
      }
      return { items: [] };
    });

    const { GET } = await routeModule();
    const res = (await GET(
      mockGetRequest({ headers: { 'x-k8s-cluster-name': 'MyCluster' } }),
      mockParams(['cluster-health']),
    )) as any;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.clusterName).toBe('MyCluster');
    expect(res.body.nodes.total).toBe(2);
    expect(res.body.nodes.ready).toBe(2);
    expect(res.body.nodes.notReady).toBe(0);
    expect(res.body.nodes.list).toHaveLength(2);
    expect(res.body.nodes.list[0].name).toBe('node1');
    expect(res.body.nodes.list[0].role).toBe('control-plane,master');
    expect(res.body.components).toEqual({
      controllerManager: 'Healthy',
      scheduler: 'Healthy',
      etcd: 'Healthy',
    });
    expect(res.body.polledAt).toBeDefined();
  });

  // -------------------------------------------------------------------
  // GET /releases
  // -------------------------------------------------------------------
  it('GET /releases returns helm releases across namespaces', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });
    vi.mocked(callK8sApi).mockResolvedValue({
      items: [
        {
          data: { release: 'base64-encoded-data' },
        },
      ],
    });
    vi.mocked(parseHelmSecret).mockResolvedValue({
      name: 'my-app',
      namespace: 'default',
      version: 3,
      info: {
        first_deployed: '2025-01-01T00:00:00Z',
        last_deployed: '2025-06-01T00:00:00Z',
        status: 'deployed',
      },
      chart: {
        metadata: { name: 'nginx', version: '15.0.0', appVersion: '1.27.0' },
      },
    });

    const { GET } = await routeModule();
    const res = (await GET(mockGetRequest(), mockParams(['releases']))) as any;
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      name: 'my-app',
      namespace: 'default',
      revision: 3,
      status: 'deployed',
      chartName: 'nginx',
      chartVersion: '15.0.0',
      appVersion: '1.27.0',
    });
  });

  it('GET /releases filters by namespace when searchParam is set', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });
    vi.mocked(callK8sApi).mockResolvedValue({ items: [] });

    const { GET } = await routeModule();
    const res = (await GET(
      mockGetRequest({ searchParams: { namespace: 'prod' } }),
      mockParams(['releases']),
    )) as any;

    expect(res.status).toBe(200);
    expect(callK8sApi).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('/namespaces/prod/secrets'),
    );
  });

  // -------------------------------------------------------------------
  // GET /activity
  // -------------------------------------------------------------------
  it('GET /activity returns k8s events', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });
    vi.mocked(callK8sApi).mockResolvedValue({
      items: [
        {
          metadata: { uid: 'evt-1', creationTimestamp: '2025-06-01T00:00:00Z' },
          lastTimestamp: '2025-06-01T12:00:00Z',
          type: 'Normal',
          involvedObject: { kind: 'Pod', name: 'my-pod' },
          message: 'Started container',
          reason: 'Started',
          source: { component: 'kubelet' },
        },
        {
          metadata: { uid: 'evt-2', creationTimestamp: '2025-06-01T00:01:00Z' },
          lastTimestamp: '2025-06-01T12:05:00Z',
          type: 'Warning',
          involvedObject: { kind: 'Node', name: 'node1' },
          message: 'DiskPressure',
          reason: 'NodeHasDiskPressure',
          source: { component: 'kubelet' },
        },
      ],
    });

    const { GET } = await routeModule();
    const res = (await GET(mockGetRequest(), mockParams(['activity']))) as any;

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      id: 'evt-2',
      type: 'k8s',
      severity: 'warning',
      category: 'cluster',
      user: 'kubelet',
    });
    expect(res.body[1]).toMatchObject({
      id: 'evt-1',
      type: 'k8s',
      severity: 'info',
      category: 'cluster',
      user: 'kubelet',
    });
  });

  // -------------------------------------------------------------------
  // GET /namespaces/:ns/quota
  // -------------------------------------------------------------------
  it('GET /namespace-quotas returns quotas for a specific namespace', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });
    vi.mocked(callK8sApi).mockResolvedValue({
      items: [
        {
          spec: {
            containers: [{ resources: { limits: { cpu: '500m' } } }],
          },
        },
      ],
    });

    const { GET } = await routeModule();
    const res = (await GET(
      mockGetRequest(),
      mockParams(['namespaces', 'default', 'quota']),
    )) as any;

    expect(res.status).toBe(200);
    expect(res.body.quotas).toBeDefined();
    expect(Array.isArray(res.body.quotas)).toBe(true);
    expect(res.body.quotas.length).toBeGreaterThan(0);
    expect(res.body.quotas[0]).toHaveProperty('name');
    expect(res.body.quotas[0]).toHaveProperty('resource');
    expect(res.body.quotas[0]).toHaveProperty('limit');
    expect(res.body.quotas[0]).toHaveProperty('used');
  });

  it('GET /namespaces/all/quota returns hardcoded summary quotas', async () => {
    // The all namespace path does not call k8s API
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });

    const { GET } = await routeModule();
    const res = (await GET(
      mockGetRequest(),
      mockParams(['namespaces', 'all', 'quota']),
    )) as any;

    expect(res.status).toBe(200);
    expect(res.body.quotas).toHaveLength(3);
    expect(res.body.quotas[0].name).toBe('CPU');
    expect(res.body.quotas[1].name).toBe('Memory');
    expect(res.body.quotas[2].name).toBe('Pods');
  });

  // -------------------------------------------------------------------
  // GET /releases/:ns/:name/usage
  // -------------------------------------------------------------------
  it('GET /resource-usage returns pod CPU/memory metrics', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });
    vi.mocked(callK8sApi).mockResolvedValue({
      items: [
        {
          metadata: {
            name: 'my-app-pod',
            labels: { release: 'my-app' },
          },
          spec: {
            containers: [
              { resources: { limits: { cpu: '500m', memory: '256Mi' } } },
            ],
          },
        },
      ],
    });

    const { GET } = await routeModule();
    const res = (await GET(
      mockGetRequest(),
      mockParams(['releases', 'default', 'my-app', 'usage']),
    )) as any;

    expect(res.status).toBe(200);
    expect(res.body.release).toBe('my-app');
    expect(res.body.namespace).toBe('default');
    expect(res.body.metrics).toBeDefined();
    expect(res.body.metrics).toHaveLength(15); // 15 data points (14..0)
    expect(res.body.metrics[0]).toHaveProperty('cpuUsage');
    expect(res.body.metrics[0]).toHaveProperty('cpuRequest');
    expect(res.body.metrics[0]).toHaveProperty('cpuLimit');
    expect(res.body.metrics[0]).toHaveProperty('memUsage');
    expect(res.body.metrics[0]).toHaveProperty('memRequest');
    expect(res.body.metrics[0]).toHaveProperty('memLimit');
    expect(res.body.podsFound).toBe(true);
  });

  // -------------------------------------------------------------------
  // GET /releases/:ns/:name (detail)
  // -------------------------------------------------------------------
  it('GET /release-detail returns detailed release info with pod counts', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });
    // First call: secrets for release
    // Second call: pods for the namespace
    vi.mocked(callK8sApi)
      .mockResolvedValueOnce({
        items: [
          {
            data: { release: 'encoded-release' },
          },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          {
            metadata: {
              name: 'my-app-abc',
              labels: { release: 'my-app' },
            },
            status: { phase: 'Running' },
          },
          {
            metadata: {
              name: 'my-app-def',
              labels: {},
            },
            status: { phase: 'Running' },
          },
        ],
      });
    vi.mocked(parseHelmSecret).mockResolvedValue({
      name: 'my-app',
      namespace: 'default',
      version: 5,
      info: {
        first_deployed: '2025-01-01T00:00:00Z',
        last_deployed: '2025-06-01T00:00:00Z',
        status: 'deployed',
        notes: 'Release notes here.',
      },
      chart: {
        metadata: { name: 'nginx', version: '15.0.0', appVersion: '1.27.0' },
      },
      config: { replicas: 3 },
      manifest: 'apiVersion: v1\nkind: Service',
    });

    const { GET } = await routeModule();
    const res = (await GET(
      mockGetRequest(),
      mockParams(['releases', 'default', 'my-app']),
    )) as any;

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('my-app');
    expect(res.body.namespace).toBe('default');
    expect(res.body.revision).toBe(5);
    expect(res.body.status).toBe('deployed');
    expect(res.body.chartName).toBe('nginx');
    expect(res.body.chartVersion).toBe('15.0.0');
    expect(res.body.appVersion).toBe('1.27.0');
    expect(res.body.notes).toBe('Release notes here.');
    expect(res.body.values).toBeDefined(); // yaml.dump of config
    expect(res.body.manifest).toBe('apiVersion: v1\nkind: Service');
    expect(res.body.history).toHaveLength(1);
    expect(res.body.podCounts.total).toBe(2);
    expect(res.body.podCounts.running).toBe(2);
    expect(res.body.k8sStatus).toBe('healthy');
  });

  // -------------------------------------------------------------------
  // POST /releases/:ns/:name/rollback
  // -------------------------------------------------------------------
  it('POST /rollback rolls back a release to a previous revision', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });
    vi.mocked(callK8sApi).mockResolvedValue({
      items: [
        {
          metadata: {
            name: 'sh.helm.release.v1.my-app.v3',
            labels: { name: 'my-app', version: '3', owner: 'helm' },
          },
          data: { release: 'encoded-v3' },
        },
        {
          metadata: {
            name: 'sh.helm.release.v1.my-app.v4',
            labels: { name: 'my-app', version: '4', owner: 'helm' },
          },
          data: { release: 'encoded-v4' },
        },
      ],
    });
    vi.mocked(parseHelmSecret).mockResolvedValue({
      name: 'my-app',
      namespace: 'default',
      version: 3,
      info: {
        status: 'superseded',
        description: 'Upgrade complete',
      },
      chart: { metadata: {} },
      config: {},
    });
    vi.mocked(encodeHelmRelease).mockResolvedValue('new-encoded-release');

    const { POST } = await routeModule();
    const res = (await POST(
      mockPostRequest({ revision: 3 }),
      mockParams(['releases', 'default', 'my-app', 'rollback']),
    )) as any;

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Rolled back to v3',
    });
  });

  it('POST /rollback returns 400 when no revision is provided', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });

    const { POST } = await routeModule();
    const res = (await POST(
      mockPostRequest({}),
      mockParams(['releases', 'default', 'my-app', 'rollback']),
    )) as any;

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Revision required' });
  });

  // -------------------------------------------------------------------
  // POST /releases/install
  // -------------------------------------------------------------------
  it('POST /install installs a new chart', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });
    vi.mocked(callK8sApi).mockResolvedValue({ items: [] });
    vi.mocked(encodeHelmRelease).mockResolvedValue('encoded-release-data');

    const { POST } = await routeModule();
    const res = (await POST(
      mockPostRequest({
        name: 'my-app',
        namespace: 'default',
        chartName: 'nginx',
        chartVersion: '15.0.0',
        valuesYaml: 'replicas: 3\n',
        isUpgrade: false,
      }),
      mockParams(['releases', 'install']),
    )) as any;

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Release my-app installed.',
    });
  });

  it('POST /install returns 400 when required fields are missing', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });

    const { POST } = await routeModule();
    const res = (await POST(
      mockPostRequest({ name: 'my-app' }), // missing namespace and chartName
      mockParams(['releases', 'install']),
    )) as any;

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Missing fields' });
  });

  // -------------------------------------------------------------------
  // POST /releases/:ns/:name/uninstall
  // -------------------------------------------------------------------
  it('POST /uninstall uninstalls a release', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });
    vi.mocked(callK8sApi).mockResolvedValue({
      items: [
        { metadata: { name: 'sh.helm.release.v1.my-app.v3' } },
        { metadata: { name: 'sh.helm.release.v1.my-app.v4' } },
      ],
    });

    const { POST } = await routeModule();
    const res = (await POST(
      mockPostRequest({}),
      mockParams(['releases', 'default', 'my-app', 'uninstall']),
    )) as any;

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Uninstalled my-app',
    });
    // Should call DELETE for each secret
    expect(callK8sApi).toHaveBeenCalledWith(
      expect.anything(),
      '/api/v1/namespaces/default/secrets/sh.helm.release.v1.my-app.v3',
      { method: 'DELETE' },
    );
    expect(callK8sApi).toHaveBeenCalledWith(
      expect.anything(),
      '/api/v1/namespaces/default/secrets/sh.helm.release.v1.my-app.v4',
      { method: 'DELETE' },
    );
  });

  // -------------------------------------------------------------------
  // POST /releases/:ns/:name/restart
  // -------------------------------------------------------------------
  it('POST /restart restarts workloads for a release', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });
    // callK8sApi is called multiple times: list deployments, patch each, list statefulsets, list daemonsets
    vi.mocked(callK8sApi)
      // deployments list
      .mockResolvedValueOnce({
        items: [{ metadata: { name: 'my-app-deploy' } }],
      })
      // patch deployment
      .mockResolvedValueOnce({})
      // statefulsets list (empty)
      .mockResolvedValueOnce({ items: [] })
      // daemonsets list (empty)
      .mockResolvedValueOnce({ items: [] });

    const { POST } = await routeModule();
    const res = (await POST(
      mockPostRequest({}),
      mockParams(['releases', 'default', 'my-app', 'restart']),
    )) as any;

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Restarted 1 workload(s)',
      restarted: 1,
    });
  });

  // -------------------------------------------------------------------
  // GET unknown path → 404
  // -------------------------------------------------------------------
  it('GET unknown path returns 404', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue({
      apiUrl: 'https://k8s.test',
      token: 'tk',
      caCert: 'test-ca',
    });

    const { GET } = await routeModule();
    const res = (await GET(mockGetRequest(), mockParams(['unknown', 'path']))) as any;

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Not found' });
  });

  // -------------------------------------------------------------------
  // DELETE handler
  // -------------------------------------------------------------------
  it('DELETE delegates to handleRoute', async () => {
    vi.mocked(getK8sConfig).mockResolvedValue(null);

    const { DELETE } = await routeModule();
    const res = (await DELETE(mockGetRequest(), mockParams(['test']))) as any;

    // Should hit auth guard → 401
    expect(res.status).toBe(401);
  });
});
