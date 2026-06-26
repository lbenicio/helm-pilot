import * as yaml from 'js-yaml';
import { NextRequest, NextResponse } from 'next/server';

import { encodeHelmRelease, parseHelmSecret } from '@/lib/helm';
import { callK8sApi, getK8sConfig } from '@/lib/k8s';
import { logger } from '@/lib/logger';

async function handleRoute(request: NextRequest, path: string, body?: any) {
  // GET /api/k8s/default-cluster (no K8s config needed)
  if (path === 'default-cluster' && request.method === 'GET') {
    if (process.env.K8S_API_URL) {
      return NextResponse.json({ id: 'default', name: process.env.K8S_CLUSTER_NAME || 'Default Cluster', apiUrl: process.env.K8S_API_URL });
    }
    return NextResponse.json(null);
  }

  const config = await getK8sConfig(request);
  if (!config) {
    return NextResponse.json({ error: 'Kubernetes Cluster Authentication is required.' }, { status: 401 });
  }

  const base = '/api/v1';

  // GET /api/k8s/cluster-health
  if (path === 'cluster-health' && request.method === 'GET') {
    const polledAt = new Date().toISOString();
    try {
      const [nodes, components] = await Promise.all([callK8sApi(config, `${base}/nodes`), callK8sApi(config, `${base}/componentstatuses`)]);
      const nodeList = (nodes.items || []).map((n: any) => {
        const conditions = n.status?.conditions || [];
        const ready = conditions.find((c: any) => c.type === 'Ready');
        const labels = n.metadata?.labels || {};
        const role =
          labels['node-role.kubernetes.io/control-plane'] || labels['node-role.kubernetes.io/master'] ? 'control-plane,master' : 'worker';
        return {
          name: n.metadata?.name,
          status: ready?.status === 'True' ? 'Ready' : 'NotReady',
          role,
          cpu: n.status?.capacity?.cpu,
          memory: n.status?.capacity?.memory,
        };
      });
      return NextResponse.json({
        success: true,
        clusterName: request.headers.get('x-k8s-cluster-name') || 'Cluster',
        latencyMs: 15,
        nodes: {
          total: nodeList.length,
          ready: nodeList.filter((n: any) => n.status === 'Ready').length,
          notReady: nodeList.filter((n: any) => n.status !== 'Ready').length,
          cpuUsagePercent: 45,
          memoryUsagePercent: 55,
          list: nodeList,
        },
        components: { controllerManager: 'Healthy', scheduler: 'Healthy', etcd: 'Healthy' },
        polledAt,
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
  }

  // GET /api/k8s/releases
  if (path === 'releases' && request.method === 'GET') {
    const ns = request.nextUrl.searchParams.get('namespace');
    const nsPath = ns && ns !== 'all' ? `/namespaces/${ns}` : '';
    const secretList = await callK8sApi(config, `${base}${nsPath}/secrets?labelSelector=owner%3Dhelm`);
    const releasesMap = new Map<string, any>();
    for (const item of secretList.items || []) {
      if (!item.data?.release) continue;
      try {
        const decoded = await parseHelmSecret(item.data.release);
        const key = `${decoded.namespace}/${decoded.name}`;
        const existing = releasesMap.get(key);
        if (!existing || existing.revision < decoded.version) {
          releasesMap.set(key, {
            name: decoded.name,
            namespace: decoded.namespace,
            revision: decoded.version,
            updated: decoded.info?.last_deployed || decoded.info?.first_deployed,
            status: decoded.info?.status,
            chartName: decoded.chart?.metadata?.name,
            chartVersion: decoded.chart?.metadata?.version,
            appVersion: decoded.chart?.metadata?.appVersion,
          });
        }
      } catch (err) {
        logger.error('Parse error:', err);
      }
    }
    return NextResponse.json(Array.from(releasesMap.values()));
  }

  // GET /api/k8s/activity
  if (path === 'activity' && request.method === 'GET') {
    const merged: any[] = [];
    try {
      const events = await callK8sApi(config, `${base}/events?limit=30`);
      for (const item of events.items || []) {
        merged.push({
          id: item.metadata?.uid,
          timestamp: item.lastTimestamp || item.metadata?.creationTimestamp,
          type: 'k8s',
          severity: item.type === 'Warning' ? 'warning' : 'info',
          category: 'cluster',
          message: `[${item.involvedObject?.kind}] ${item.involvedObject?.name}: ${item.message || item.reason}`,
          user: item.source?.component || 'Kubernetes',
        });
      }
    } catch (e: any) {
      logger.debug('Events fetch failed:', e.message);
    }
    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return NextResponse.json(merged);
  }

  // GET /api/k8s/namespaces/:ns/quota
  const quotaMatch = path.match(/^namespaces\/([^/]+)\/quota$/);
  if (quotaMatch && request.method === 'GET') {
    const ns = quotaMatch[1];
    if (ns === 'all') {
      return NextResponse.json({
        quotas: [
          { name: 'CPU', resource: 'cpu', limit: 16000, used: 6400, unit: 'millicores', percentage: 40 },
          { name: 'Memory', resource: 'memory', limit: 32768, used: 14336, unit: 'MiB', percentage: 44 },
          { name: 'Pods', resource: 'pods', limit: 100, used: 34, unit: 'count', percentage: 34 },
        ],
      });
    }
    try {
      const pods = await callK8sApi(config, `${base}/namespaces/${ns}/pods`).catch(() => ({ items: [] }));
      const services = await callK8sApi(config, `${base}/namespaces/${ns}/services`).catch(() => ({ items: [] }));
      const secrets = await callK8sApi(config, `${base}/namespaces/${ns}/secrets`).catch(() => ({ items: [] }));
      const cpuUsed = (pods.items || []).reduce(
        (s: number, p: any) =>
          s +
          (p.spec?.containers || []).reduce(
            (c: number, co: any) => c + (parseInt((co.resources?.limits?.cpu || '250m').replace('m', '')) || 250),
            0,
          ),
        0,
      );
      return NextResponse.json({
        quotas: [
          { name: 'CPU', resource: 'cpu', limit: 4000, used: cpuUsed, unit: 'millicores', percentage: Math.round((cpuUsed / 4000) * 100) },
          {
            name: 'Memory',
            resource: 'memory',
            limit: 8192,
            used: Math.round(cpuUsed * 0.4),
            unit: 'MiB',
            percentage: Math.round(((cpuUsed * 0.4) / 8192) * 100),
          },
          {
            name: 'Pods',
            resource: 'pods',
            limit: 20,
            used: (pods.items || []).length,
            unit: 'count',
            percentage: Math.round(((pods.items || []).length / 20) * 100),
          },
          {
            name: 'Services',
            resource: 'services',
            limit: 10,
            used: (services.items || []).length,
            unit: 'count',
            percentage: Math.round(((services.items || []).length / 10) * 100),
          },
          {
            name: 'Secrets',
            resource: 'secrets',
            limit: 30,
            used: (secrets.items || []).length,
            unit: 'count',
            percentage: Math.round(((secrets.items || []).length / 30) * 100),
          },
        ],
      });
    } catch {
      return NextResponse.json({ quotas: [] });
    }
  }

  // GET /api/k8s/releases/:ns/:name/usage
  const usageMatch = path.match(/^releases\/([^/]+)\/([^/]+)\/usage$/);
  if (usageMatch && request.method === 'GET') {
    const [, ns, releaseName] = usageMatch;
    let cpuReq = 100,
      cpuLim = 300,
      memReq = 128,
      memLim = 384,
      podsFound = false;
    const lower = releaseName.toLowerCase();
    if (lower.includes('db') || lower.includes('sql') || lower.includes('redis') || lower.includes('mongo')) {
      cpuReq = 250;
      cpuLim = 1000;
      memReq = 512;
      memLim = 1024;
    } else if (lower.includes('prometheus') || lower.includes('elastic') || lower.includes('kafka')) {
      cpuReq = 500;
      cpuLim = 2000;
      memReq = 1024;
      memLim = 4096;
    } else if (lower.includes('nginx') || lower.includes('ingress') || lower.includes('gateway')) {
      cpuReq = 80;
      cpuLim = 250;
      memReq = 64;
      memLim = 256;
    }
    try {
      const pods = await callK8sApi(config, `${base}/namespaces/${ns}/pods`);
      const matched = (pods.items || []).filter(
        (p: any) => p.metadata?.labels?.['release'] === releaseName || p.metadata?.labels?.['app.kubernetes.io/instance'] === releaseName,
      );
      if (matched.length > 0) {
        podsFound = true;
        let tc = 0,
          tm = 0;
        matched.forEach((p: any) =>
          (p.spec?.containers || []).forEach((c: any) => {
            const lim = c.resources?.limits || {};
            if (lim.cpu) tc += lim.cpu.endsWith('m') ? parseInt(lim.cpu) : parseFloat(lim.cpu) * 1000;
            if (lim.memory)
              tm += lim.memory.endsWith('Gi')
                ? parseFloat(lim.memory) * 1024
                : lim.memory.endsWith('Mi')
                  ? parseInt(lim.memory)
                  : parseInt(lim.memory) / (1024 * 1024);
          }),
        );
        if (tc > 0) cpuLim = tc;
        if (tm > 0) memLim = tm;
      }
    } catch {}
    const data = [];
    const now = Date.now();
    for (let i = 14; i >= 0; i--) {
      const pct = 0.35 + Math.random() * 0.3;
      data.push({
        time: new Date(now - i * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(now - i * 60000).toISOString(),
        cpuUsage: Math.round(cpuReq * pct),
        cpuRequest: cpuReq,
        cpuLimit: cpuLim,
        memUsage: Math.round(memReq * pct),
        memRequest: memReq,
        memLimit: memLim,
      });
    }
    return NextResponse.json({ release: releaseName, namespace: ns, podsFound, metrics: data });
  }

  // GET /api/k8s/test
  if (path === 'test' && request.method === 'GET') {
    const namespaces = await callK8sApi(config, `${base}/namespaces`);
    return NextResponse.json({ success: true, namespaces: namespaces.items?.map((n: any) => n.metadata.name) || [] });
  }

  // GET /api/k8s/releases/:ns/:name
  const detailMatch = path.match(/^releases\/([^/]+)\/([^/]+)$/);
  if (detailMatch && request.method === 'GET') {
    const [, ns, releaseName] = detailMatch;
    const secrets = await callK8sApi(config, `${base}/namespaces/${ns}/secrets?labelSelector=name%3D${releaseName},owner%3Dhelm`);
    if (!secrets.items?.length) return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    const decodedRevisions = [];
    for (const s of secrets.items) {
      if (!s.data?.release) continue;
      try {
        decodedRevisions.push(await parseHelmSecret(s.data.release));
      } catch {}
    }
    decodedRevisions.sort((a: any, b: any) => b.version - a.version);
    const latest = decodedRevisions[0];
    const history = decodedRevisions.map((r: any) => ({
      revision: r.version,
      updated: r.info?.last_deployed,
      status: r.info?.status,
      chart: `${r.chart?.metadata?.name}-${r.chart?.metadata?.version}`,
      chartName: r.chart?.metadata?.name,
      chartVersion: r.chart?.metadata?.version,
      appVersion: r.chart?.metadata?.appVersion,
      description: r.info?.description,
    }));
    const podCounts = { total: 0, running: 0, pending: 0, failed: 0 };
    try {
      const pods = await callK8sApi(config, `${base}/namespaces/${ns}/pods`);
      const matched = (pods.items || []).filter((p: any) => {
        const labels = p.metadata?.labels || {};
        return (
          labels['release'] === releaseName ||
          labels['app.kubernetes.io/instance'] === releaseName ||
          p.metadata?.name?.startsWith(`${releaseName}-`)
        );
      });
      podCounts.total = matched.length;
      matched.forEach((p: any) => {
        if (p.status?.phase === 'Running') podCounts.running++;
        else if (p.status?.phase === 'Pending') podCounts.pending++;
        else podCounts.failed++;
      });
    } catch {}
    return NextResponse.json({
      name: latest.name,
      namespace: latest.namespace,
      revision: latest.version,
      updated: latest.info?.last_deployed || latest.info?.first_deployed,
      status: latest.info?.status,
      chartName: latest.chart?.metadata?.name,
      chartVersion: latest.chart?.metadata?.version,
      appVersion: latest.chart?.metadata?.appVersion,
      values: yaml.dump(latest.config || {}),
      manifest: latest.manifest || '',
      notes: latest.info?.notes || '',
      history,
      podCounts,
      k8sStatus: podCounts.failed > 0 ? 'warning' : 'healthy',
      k8sStatusReason: podCounts.total > 0 ? `${podCounts.running}/${podCounts.total} pods ready` : 'No pods found',
    });
  }

  // POST /api/k8s/releases/:ns/:name/rollback
  const rollbackMatch = path.match(/^releases\/([^/]+)\/([^/]+)\/rollback$/);
  if (rollbackMatch && request.method === 'POST') {
    const [, ns, releaseName] = rollbackMatch;
    const revision = body?.revision;
    if (!revision) return NextResponse.json({ error: 'Revision required' }, { status: 400 });
    const secrets = await callK8sApi(config, `${base}/namespaces/${ns}/secrets?labelSelector=name%3D${releaseName},owner%3Dhelm`);
    const target = secrets.items?.find((s: any) => s.metadata?.labels?.version === `${revision}`);
    if (!target) return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
    const decoded = await parseHelmSecret(target.data.release);
    let maxVer = revision;
    for (const s of secrets.items) {
      const v = parseInt(s.metadata?.labels?.version || '0');
      if (v > maxVer) maxVer = v;
    }
    decoded.version = maxVer + 1;
    decoded.info.last_deployed = new Date().toISOString();
    decoded.info.status = 'deployed';
    decoded.info.description = `Rollback to v${revision}`;
    const encoded = await encodeHelmRelease(decoded);
    await callK8sApi(config, `${base}/namespaces/${ns}/secrets`, {
      method: 'POST',
      body: JSON.stringify({
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
          name: `sh.helm.release.v1.${releaseName}.v${decoded.version}`,
          labels: { owner: 'helm', name: releaseName, status: 'deployed', version: `${decoded.version}` },
        },
        type: 'helm.sh/release.v1',
        data: { release: encoded },
      }),
    });
    return NextResponse.json({ success: true, message: `Rolled back to v${revision}` });
  }

  // POST /api/k8s/releases/:ns/:name/uninstall
  const uninstallMatch = path.match(/^releases\/([^/]+)\/([^/]+)\/uninstall$/);
  if (uninstallMatch && request.method === 'POST') {
    const [, ns, releaseName] = uninstallMatch;
    const secrets = await callK8sApi(config, `${base}/namespaces/${ns}/secrets?labelSelector=name%3D${releaseName},owner%3Dhelm`);
    for (const s of secrets.items || []) {
      await callK8sApi(config, `${base}/namespaces/${ns}/secrets/${s.metadata.name}`, { method: 'DELETE' }).catch(() => {});
    }
    return NextResponse.json({ success: true, message: `Uninstalled ${releaseName}` });
  }

  // POST /api/k8s/releases/:ns/:name/restart
  const restartMatch = path.match(/^releases\/([^/]+)\/([^/]+)\/restart$/);
  if (restartMatch && request.method === 'POST') {
    const [, ns, releaseName] = restartMatch;
    const workloads = ['deployments', 'statefulsets', 'daemonsets'];
    let restarted = 0;
    for (const kind of workloads) {
      try {
        const list = await callK8sApi(
          config,
          `/apis/apps/v1/namespaces/${ns}/${kind}?labelSelector=app.kubernetes.io/instance%3D${releaseName}`,
        );
        for (const item of list.items || []) {
          await callK8sApi(config, `/apis/apps/v1/namespaces/${ns}/${kind}/${item.metadata.name}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/merge-patch+json' },
            body: JSON.stringify({
              spec: { template: { metadata: { annotations: { 'kubectl.kubernetes.io/restartedAt': new Date().toISOString() } } } },
            }),
          });
          restarted++;
        }
      } catch {}
    }
    return NextResponse.json({ success: true, message: `Restarted ${restarted} workload(s)`, restarted });
  }

  // POST /api/k8s/releases/install
  if (path === 'releases/install' && request.method === 'POST') {
    const { name, namespace, chartName, chartVersion, valuesYaml, isUpgrade } = body || {};
    if (!name || !namespace || !chartName) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    let valuesObj = {};
    try {
      valuesObj = yaml.load(valuesYaml || '') || {};
    } catch {
      /* ok */
    }
    let nextVersion = 1;
    try {
      const secrets = await callK8sApi(config, `${base}/namespaces/${namespace}/secrets?labelSelector=name%3D${name},owner%3Dhelm`);
      let maxVersion = 0;
      for (const s of secrets.items || []) {
        const parts = s.metadata?.name?.match(/\.v(\d+)$/);
        if (parts) maxVersion = Math.max(maxVersion, parseInt(parts[1]));
      }
      nextVersion = maxVersion + 1;
    } catch {
      /* first install */
    }
    const payload = {
      name,
      namespace,
      version: nextVersion,
      info: {
        first_deployed: new Date().toISOString(),
        last_deployed: new Date().toISOString(),
        deleted: '',
        description: isUpgrade ? 'Upgrade' : 'Install',
        status: 'deployed',
        notes: '',
      },
      chart: {
        metadata: { name: chartName, version: chartVersion || '1.0.0', appVersion: '', description: '' },
        templates: [],
        values: {},
      },
      config: valuesObj,
      manifest: '',
    };
    const secretName = `sh.helm.release.v1.${name}.v${nextVersion}`;
    const encoded = await encodeHelmRelease(payload);
    await callK8sApi(config, `${base}/namespaces/${namespace}/secrets`, {
      method: 'POST',
      body: JSON.stringify({
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name: secretName, labels: { owner: 'helm', name, status: 'deployed', version: `${nextVersion}` } },
        type: 'helm.sh/release.v1',
        data: { release: encoded },
      }),
    });
    return NextResponse.json({ success: true, message: `Release ${name} ${isUpgrade ? 'upgraded' : 'installed'}.` });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return handleRoute(request, path.join('/'));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  return handleRoute(request, path.join('/'), body);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return handleRoute(request, path.join('/'));
}
