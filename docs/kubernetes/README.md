# Kubernetes Integration

Helm Pilot connects to Kubernetes clusters via the REST API to manage Helm releases, monitor cluster health, and proxy API operations. It supports two connection methods — environment-variable-based defaults and a browser-driven cluster selector — and two authentication strategies — direct OIDC bearer tokens and service account impersonation.

## How It Works

1. **Cluster Resolution** — Helm Pilot determines which cluster to talk to by checking a `x-k8s-api-url` header from the browser, falling back to the `K8S_API_URL` environment variable. If neither is set, the client requests `/api/k8s/default-cluster` to auto-detect a pre-configured default.
2. **Authentication** — Every K8s API call is authorized with a bearer token. In the most common setup, this is the user's OIDC access token (passed via the session cookie). When `K8S_TOKEN` is set, the server uses a service account token for its own auth and adds impersonation headers to act on behalf of the OIDC user.
3. **TLS Handling** — Self-signed or private CA certificates are common in development clusters. Setting `OIDC_SKIP_TLS_VERIFY=true` propagates `NODE_TLS_REJECT_UNAUTHORIZED=0` into the Node.js runtime, bypassing TLS verification for both OIDC and K8s API calls.
4. **API Proxy** — The `/api/k8s/[...path]` catch-all route proxies requests to the Kubernetes API server, constructing authentication headers via the `callK8sApi` function and returning JSON responses to the browser.

## Index

| Document | Description |
|---|---|
| [cluster-connection.md](./cluster-connection.md) | How Helm Pilot connects to clusters — env vars, UI cluster selector, default cluster detection, auth methods, TLS, headers, test connection, and status indicator |
| [helm-releases.md](./helm-releases.md) | Helm release management — discovery, parsing, lifecycle (install/upgrade/rollback/uninstall/restart), detail views, bulk operations, and the chart deployment wizard |
| [impersonation.md](./impersonation.md) | Kubernetes service account impersonation — when to use, how it works, SA setup, group handling, debugging, and comparison with direct OIDC mode |

## Quick Reference

### Connection Headers (sent from browser to Helm Pilot)

| Header | Purpose |
|---|---|
| `x-k8s-api-url` | The Kubernetes API server URL (e.g. `https://10.100.0.1:6443`) |
| `x-k8s-ca-cert` | Optional CA certificate for TLS verification |
| `x-k8s-token` | Bearer token (used when no OIDC session exists or for multi-cluster profiles with distinct tokens) |
| `x-k8s-cluster-name` | Human-readable cluster name for display and activity log entries |

### Key Environment Variables

```bash
# Required for default cluster (auto-detected if no UI cluster selected)
K8S_API_URL="https://your-k8s-api.example.com"
K8S_CLUSTER_NAME="Production"

# Optional: service account impersonation
K8S_TOKEN="eyJhbGciOiJSUzI1NiIs..."

# TLS for self-signed certs (also affects OIDC calls)
OIDC_SKIP_TLS_VERIFY="true"
```

### Key API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/k8s/default-cluster` | `GET` | Returns the default cluster from env vars, or `null` |
| `/api/k8s/test` | `GET` | Tests connectivity to a cluster (using headers for config) |
| `/api/k8s/cluster-health` | `GET` | Node inventory, control plane status, API latency |
| `/api/k8s/releases` | `GET` | Lists all Helm releases (optional `?namespace=` filter) |
| `/api/k8s/releases/:ns/:name` | `GET` | Release detail with history, values, manifest, pod status |
| `/api/k8s/releases/:ns/:name/rollback` | `POST` | Rolls back a release to a specific revision |
| `/api/k8s/releases/:ns/:name/uninstall` | `POST` | Deletes all Helm release secrets |
| `/api/k8s/releases/:ns/:name/restart` | `POST` | Triggers a rolling restart of workloads |
| `/api/k8s/releases/install` | `POST` | Installs or upgrades a chart |
| `/api/k8s/[...path]` | `GET,P` | Catch-all proxy for arbitrary K8s API calls |

## Further Reading

- See [Authentication > RBAC](../authentication/rbac.md) for ClusterRole examples and 403 troubleshooting.
- See [Getting Started > Configuration](../getting-started/configuration.md) for the complete environment variable reference.
- See [Architecture > API Design](../architecture/api-design.md) for the full API route specification.
