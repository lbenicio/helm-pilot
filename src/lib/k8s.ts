import { NextRequest } from 'next/server';
import { getSession } from './session';

export async function getK8sConfig(request: NextRequest) {
  const apiUrl = request.headers.get('x-k8s-api-url') || process.env.K8S_API_URL;
  const caCert = request.headers.get('x-k8s-ca-cert') || process.env.K8S_CA_CERT;
  const session = await getSession(request);

  if (!apiUrl) return null;

  if (process.env.K8S_TOKEN) {
    return {
      apiUrl,
      token: process.env.K8S_TOKEN,
      caCert,
      impersonateUser: session?.email,
      impersonateGroups: session?.groups,
    };
  }

  const headerToken = request.headers.get('x-k8s-token');
  const token = (headerToken && headerToken !== 'undefined') ? headerToken : session?.token;
  if (!token) return null;

  return { apiUrl, token, caCert };
}

export async function callK8sApi(
  config: { apiUrl: string; token: string; caCert?: string; impersonateUser?: string; impersonateGroups?: string[] },
  path: string,
  options: RequestInit = {}
) {
  const url = `${config.apiUrl}${path}`;

  if (config.impersonateUser) {
    const headers: [string, string][] = [
      ['Authorization', `Bearer ${config.token}`],
      ['Content-Type', 'application/json'],
      ['Impersonate-User', config.impersonateUser],
    ];
    if (config.impersonateGroups?.length) {
      // Node fetch merges same-name headers, so only send first group
      headers.push(['Impersonate-Group', config.impersonateGroups[0]]);
    }
    if (options.headers) {
      Object.entries(options.headers).forEach(([k, v]) => headers.push([k, String(v)]));
    }
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) throw new Error(`Kubernetes API error ${res.status}: ${await res.text()}`);
    return res.json();
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${config.token}`,
    'Content-Type': 'application/json',
    ...Object.fromEntries(Object.entries(options.headers || {}).map(([k, v]) => [k, String(v)])),
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) throw new Error(`Kubernetes API error ${res.status}: ${await res.text()}`);
  return res.json();
}
