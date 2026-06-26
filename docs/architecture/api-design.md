# API Design

All API routes live under `src/app/api/` and follow Next.js App Router conventions. Each route is a `route.ts` file exporting HTTP method handlers (`GET`, `POST`, `DELETE`, `PATCH`).

---

## Authentication (`/api/auth/*`)

Helm Pilot supports **OIDC-based authentication** via any OpenID Connect provider (Keycloak, Okta, Dex, etc.). The flow is standard Authorization Code with PKCE support provided by `openid-client` v6.

### `GET /api/auth/url`

Generates the OIDC authorization URL.

**Flow:**

1. Reads `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` from environment.
2. Generates a random `state` value for CSRF protection.
3. Builds the authorization URL with the configured scopes (`OIDC_SCOPES`, defaults to `openid profile email`).
4. Sets the `state` in an `HttpOnly` cookie (`oidc_state`, 10-minute expiry).
5. Returns the authorization URL to the client.

**Response:**

```json
{
  "url": "https://provider.example.com/authorize?...",
  "type": "oidc"
}
```

**Error:** Returns `500` with `{ error: "OIDC not configured." }` if client ID or secret are missing.

### `GET /api/auth/callback`

Handles the OIDC redirect callback. Exchanges the authorization code for tokens.

**Flow:**

1. Reads the `code` and `state` from query parameters.
2. Retrieves the `oidc_state` cookie for state validation.
3. Performs the authorization code grant via `openid-client`.
4. Extracts claims (`email`, `name`, `groups`, `id_token`/`access_token`).
5. Falls back to the `userinfo_endpoint` if name/email are not available in the ID token claims.
6. Checks group authorization if `OIDC_ALLOWED_GROUPS` is configured.
7. Creates a session JWT and sets the `helm_session` cookie.
8. Clears the `oidc_state` cookie.
9. Redirects to `/`.

**Error responses:**

| Status | Condition |
| --- | --- |
| `401` | Token exchange failed (bad code, expired state, etc.) |
| `403` | User's groups do not match `OIDC_ALLOWED_GROUPS` |
| `500` | OIDC client ID not configured |

### `GET /api/auth/session`

Returns the current session information.

**Response (authenticated):**

```json
{
  "email": "user@example.com",
  "name": "Jane Operator",
  "authenticated": true
}
```

**Response (unauthenticated):**

```json
{
  "authenticated": false
}
```

### `POST /api/auth/logout`

Clears the `helm_session` cookie and returns a success response. There is no server-side session invalidation — logout is purely cookie-based.

---

## Kubernetes proxy (`/api/k8s/[...path]`)

The K8s API is a **single catch-all route** that dispatches operations based on path string matching and HTTP method. All K8s operations require authentication and proxying through the Kubernetes API server.

### Request flow

```
Client fetch("/api/k8s/releases/kube-system/coredns")
  → Next.js API route handler
    → getK8sConfig(request)   — resolves API URL, token, impersonation
    → getSession(request)     — decodes JWT cookie
    → callK8sApi(config, path) — fetches from K8s API
    → Transform & return JSON
```

### K8s configuration resolution

The `getK8sConfig()` function resolves the K8s API configuration from:

1. **Request headers:**
   - `x-k8s-api-url` — Override the K8s API server URL (per-request cluster switching)
   - `x-k8s-ca-cert` — Override the CA certificate
   - `x-k8s-token` — Override the bearer token

2. **Environment variables:**
   - `K8S_API_URL` — Default K8s API server URL
   - `K8S_CA_CERT` — Default CA certificate
   - `K8S_TOKEN` — Service account token (enables impersonation mode)

### Impersonation mode

When `K8S_TOKEN` is set (indicating a service-account-based deployment), the K8s client adds Kubernetes **impersonation headers** to every request:

| Header | Value |
| --- | --- |
| `Impersonate-User` | `session.email` (from JWT) |
| `Impersonate-Group` | First entry from `session.groups` |

This allows the application to act on behalf of the authenticated user while using a single service account token, enforcing K8s RBAC per-user.

Without `K8S_TOKEN`, the client uses the user's OIDC token directly as the bearer token.

### Supported operations

| Method | Path pattern | Description |
| --- | --- | --- |
| `GET` | `default-cluster` | Returns the default cluster info (no K8s config needed) |
| `GET` | `cluster-health` | Fetches node and component statuses; returns aggregated health data |
| `GET` | `releases` | Lists Helm releases across all or a specific namespace (`?namespace=`) |
| `GET` | `releases/:ns/:name` | Gets a single release with full detail (history, pod counts, values, manifest) |
| `GET` | `releases/:ns/:name/usage` | Gets resource usage metrics for a release's pods |
| `GET` | `namespaces/:ns/quota` | Gets namespace-level resource quota statistics |
| `GET` | `test` | Simple connectivity test — lists namespaces |
| `GET` | `activity` | Fetches recent K8s events |
| `POST` | `releases/install` | Installs or upgrades a Helm release |
| `POST` | `releases/:ns/:name/rollback` | Rolls back a release to a specified revision |
| `POST` | `releases/:ns/:name/uninstall` | Uninstalls a release (deletes all Helm Secret revisions) |
| `POST` | `releases/:ns/:name/restart` | Restarts workloads (Deployments, StatefulSets, DaemonSets) for a release |

> **Note:** The empty subdirectories under `src/app/api/k8s/` (`activity/`, `cluster-health/`, `default-cluster/`, `namespaces/`, `releases/`, `test/`) are artifacts. All routing is handled by the `[...path]/route.ts` catch-all.

### Cluster health (`GET /api/k8s/cluster-health`)

Fetches `/api/v1/nodes` and `/api/v1/componentstatuses` from the K8s API. Returns:

```json
{
  "success": true,
  "clusterName": "my-cluster",
  "latencyMs": 15,
  "nodes": {
    "total": 3,
    "ready": 3,
    "notReady": 0,
    "cpuUsagePercent": 45,
    "memoryUsagePercent": 55,
    "list": [
      { "name": "node-1", "status": "Ready", "role": "control-plane,master", "cpu": "4", "memory": "16Gi" }
    ]
  },
  "components": {
    "controllerManager": "Healthy",
    "scheduler": "Healthy",
    "etcd": "Healthy"
  },
  "polledAt": "2025-01-01T00:00:00.000Z"
}
```

### Release install/upgrade (`POST /api/k8s/releases/install`)

Creates a new Helm release or upgrades an existing one by writing a `helm.sh/release.v1` Secret to the target namespace.

**Request body:**

```json
{
  "name": "my-release",
  "namespace": "default",
  "chartName": "nginx",
  "chartVersion": "15.0.0",
  "valuesYaml": "replicaCount: 2",
  "isUpgrade": false
}
```

The handler auto-increments the release version by inspecting existing Secrets with the label `name=<releaseName>,owner=helm`.

### Rollback (`POST /api/k8s/releases/:ns/:name/rollback`)

Copies the target revision's release data, increments the version, updates the `last_deployed` timestamp and description, and creates a new Secret.

**Request body:**

```json
{ "revision": 3 }
```

### Uninstall (`POST /api/k8s/releases/:ns/:name/uninstall`)

Deletes all Secrets labeled `name=<releaseName>,owner=helm` in the namespace.

### Restart (`POST /api/k8s/releases/:ns/:name/restart`)

Patches Deployments, StatefulSets, and DaemonSets matching the release label (`app.kubernetes.io/instance=<releaseName>`) with a new `kubectl.kubernetes.io/restartedAt` annotation, triggering a rolling restart.

### Error handling

| Status | Condition |
| --- | --- |
| `401` | No valid K8s configuration (missing `K8S_API_URL` or token) |
| `404` | Release, revision, or resource not found |
| `502` | K8s API request failed (network error, API error) |

---

## Helm repo management (`/api/repos/*`)

Helm chart repositories are stored in **process memory** (see `src/lib/repos.ts`). They persist only for the lifetime of the Node.js process.

### `GET /api/repos`

Returns the current list of registered repositories.

```json
[
  { "name": "bitnami", "url": "https://charts.bitnami.com/bitnami" },
  { "name": "grafana", "url": "https://grafana.github.io/helm-charts" }
]
```

### `POST /api/repos/add`

Adds a new repository.

**Request body:**

```json
{ "name": "bitnami", "url": "https://charts.bitnami.com/bitnami" }
```

**Response (success):**

```json
{ "success": true, "repos": [...] }
```

**Response (error):** `400` if name/url missing or repo already exists.

The URL is normalized by stripping trailing slashes. Repo names are case-insensitive for deduplication.

### `DELETE /api/repos/:name`

Removes a repository by name (case-insensitive).

**Response:**

```json
{ "success": true, "repos": [...] }
```

### `GET /api/repos/search?q=&repo=`

Searches charts across all registered repositories. Fetches each repo's `index.yaml`, parses it, and filters by chart name/description.

**Query parameters:**

| Param | Description |
| --- | --- |
| `q` | Filter charts by name or description (case-insensitive) |
| `repo` | Limit search to a specific repository name |

Uses a **10-minute cache** (`searchCache` Map) per repo URL to avoid redundant `index.yaml` fetches.

### `POST /api/repos/auto-detect`

Auto-detects Helm repositories relevant to the cluster. Scans the K8s cluster for existing Helm releases, extracts chart names, then probes a built-in list of known repositories to find matches. Automatically adds matching repos to the registry.

**Known repos probed:**

`bitnami`, `prometheus-community`, `grafana`, `ingress-nginx`, `cert-manager`, `hashicorp`, `traefik`, `metallb`.

**Requires K8s authentication.** Returns `401` if no K8s config is available.

---

## Health endpoints

### `GET /api/health`

Application health check. Returns uptime and timestamp.

```json
{ "status": "OK", "uptime": 123.456, "timestamp": "2025-01-01T00:00:00.000Z" }
```

### `GET /api/healthz`

Simple health check (alternative path).

```json
{ "status": "OK", "timestamp": "2025-01-01T00:00:00.000Z" }
```

### `GET /api/live`

Kubernetes **liveness probe** endpoint. Always returns `200 OK` as long as the process is running.

```json
{ "status": "OK" }
```

### `GET /api/ready`

Kubernetes **readiness probe** endpoint. Returns `200 OK` when the application is ready to serve traffic.

```json
{ "status": "OK" }
```

---

## Session management

### Cookie details

| Attribute | Value |
| --- | --- |
| Name | `helm_session` |
| Type | JWT (HS256) |
| Library | `jose` v6 |
| Secret | `process.env.SESSION_SECRET` (falls back to a hardcoded dev key) |
| Expiry | 24 hours (`maxAge: 86400`) |
| `HttpOnly` | `true` |
| `Secure` | `true` in production (`NODE_ENV === "production"`) |
| `SameSite` | `lax` |
| `Path` | `/` |

### Session payload (`SessionUser`)

```ts
interface SessionUser {
  email: string;
  name: string;
  token?: string;       // OIDC id_token or access_token
  groups?: string[];    // OIDC groups claim
}
```

The session token can be the user's `id_token` (preferred) or `access_token`, depending on what the OIDC provider returns. This token is then used as the bearer token for K8s API calls (unless `K8S_TOKEN` impersonation mode is active).

---

## Common patterns

### Request → K8s proxy flow

All K8s API routes follow the same pattern:

1. `getK8sConfig(request)` — resolves API URL and authentication
2. If no config → `401 { error: "Kubernetes Cluster Authentication is required." }`
3. `callK8sApi(config, k8sPath, options)` — proxies to the K8s API
4. Transform response data
5. Return JSON

### Error response format

All API errors follow a consistent shape:

```json
{ "error": "Human-readable error message" }
```

HTTP status codes follow standard REST semantics:

| Code | Meaning |
| --- | --- |
| `200` | Success |
| `400` | Bad request (missing fields, duplicate repo) |
| `401` | Missing or invalid K8s configuration / authentication |
| `403` | Unauthorized OIDC groups |
| `404` | Resource not found |
| `500` | Server error (misconfiguration, unexpected failure) |
| `502` | K8s API call failed |
