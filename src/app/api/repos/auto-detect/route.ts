import { NextRequest, NextResponse } from 'next/server';
import * as yaml from 'js-yaml';
import { getK8sConfig, callK8sApi } from '@/lib/k8s';
import { parseHelmSecret } from '@/lib/helm';
import { getRepos } from '@/lib/repos';
import { logger } from '@/lib/logger';

const knownRepos = [
  { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' },
  { name: 'prometheus-community', url: 'https://prometheus-community.github.io/helm-charts' },
  { name: 'grafana', url: 'https://grafana.github.io/helm-charts' },
  { name: 'ingress-nginx', url: 'https://kubernetes.github.io/ingress-nginx' },
  { name: 'cert-manager', url: 'https://charts.jetstack.io' },
  { name: 'hashicorp', url: 'https://helm.releases.hashicorp.com' },
  { name: 'traefik', url: 'https://traefik.github.io/charts' },
  { name: 'metallb', url: 'https://metallb.github.io/metallb' },
];

export async function POST(request: NextRequest) {
  const config = await getK8sConfig(request);
  if (!config) {
    return NextResponse.json({ error: 'Kubernetes Cluster Authentication is required.' }, { status: 401 });
  }

  try {
    const secretList = await callK8sApi(config, '/api/v1/secrets?labelSelector=owner%3Dhelm');
    const chartNames = new Set<string>();
    for (const item of (secretList.items || [])) {
      if (!item.data?.release) continue;
      try {
        const decoded = await parseHelmSecret(item.data.release);
        if (decoded.chart?.metadata?.name) chartNames.add(decoded.chart.metadata.name.toLowerCase());
      } catch {}
    }

    const repos = getRepos();
    const added: string[] = [];

    for (const repo of knownRepos) {
      if (repos.some(r => r.url === repo.url)) continue;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(`${repo.url}/index.yaml`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!resp.ok) continue;
        const index = yaml.load(await resp.text()) as any;
        if (index?.entries && Array.from(chartNames).some(n => index.entries[n])) {
          repos.push(repo);
          added.push(repo.name);
        }
      } catch {}
    }

    return NextResponse.json({ success: true, added, repos });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
