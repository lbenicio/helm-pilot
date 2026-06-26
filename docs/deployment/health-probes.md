# Health Probes

Helm Pilot exposes lightweight HTTP endpoints for use with Kubernetes probes, load balancer health checks, and uptime monitoring. Each endpoint returns a JSON response with a `200 OK` status when healthy.

---

## Available Endpoints

### Top-Level Paths (rewritten via `next.config.ts`)

The following top-level paths are rewritten to their `/api/*` counterparts. Rewrites are transparent — the browser and any HTTP client see only the top-level URL.

| URL | Internal handler | Purpose |
|---|---|---|
| `GET /health` | `GET /api/health` | General health check with uptime |
| `GET /healthz` | `GET /api/healthz` | Alternative health check with timestamp |
| `GET /live` | `GET /api/live` | Liveness probe |
| `GET /liveness` | `GET /api/live` | Alias for `/live` |
| `GET /ready` | `GET /api/ready` | Readiness probe |
| `GET /readiness` | `GET /api/ready` | Alias for `/ready` |

### Direct API Paths

The `/api/*` variants are also accessible directly. Using the top-level paths is recommended because they are shorter and consistent with Kubernetes conventions.

---

## Endpoint Details

### `GET /health` → `GET /api/health`

Returns the server status, process uptime, and a timestamp. This is the most informative endpoint and is recommended for startup probes and monitoring dashboards.

**Response:** `200 OK`

```json
{
  "status": "OK",
  "uptime": 8423.456,
  "timestamp": "2026-06-26T12:34:56.789Z"
}
```

**Implementation** (`src/app/api/health/route.ts`):

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
```

### `GET /healthz` → `GET /api/healthz`

A minimal health check that returns status and timestamp. Identical in behaviour to `/health` but follows the `/healthz` convention used by some monitoring tools.

**Response:** `200 OK`

```json
{
  "status": "OK",
  "timestamp": "2026-06-26T12:34:56.789Z"
}
```

**Implementation** (`src/app/api/healthz/route.ts`):

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
}
```

### `GET /live` → `GET /api/live`

Liveness probe endpoint. Returns `200 OK` as long as the Node.js process is running and the Next.js route handler is reachable. Does **not** check downstream dependencies (K8s API, OIDC provider). This is intentional — a liveness probe should only indicate whether the process itself is alive, not whether external systems are healthy.

**Response:** `200 OK`

```json
{ "status": "OK" }
```

**Implementation** (`src/app/api/live/route.ts`):

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'OK' });
}
```

### `GET /ready` → `GET /api/ready`

Readiness probe endpoint. Returns `200 OK` when the server is ready to accept traffic. Currently identical to the liveness probe — the server is ready as soon as the Node.js process is running and the route handler responds.

**Response:** `200 OK`

```json
{ "status": "OK" }
```

**Implementation** (`src/app/api/ready/route.ts`):

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'OK' });
}
```

---

## Rewrite Configuration

The rewrite rules are defined in `next.config.ts`. They map short, top-level paths to the full API route paths:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/health', destination: '/api/health' },
      { source: '/healthz', destination: '/api/healthz' },
      { source: '/live', destination: '/api/live' },
      { source: '/liveness', destination: '/api/live' },
      { source: '/ready', destination: '/api/ready' },
      { source: '/readiness', destination: '/api/ready' },
    ];
  },
};

export default nextConfig;
```

> **Note:** Rewrites are handled internally by Next.js. The client never receives a redirect — the response comes directly from the destination route handler, preserving the original URL.

---

## Kubernetes Probe Configuration

Below is the recommended probe configuration from the Kubernetes Deployment manifest. For full context, see [Kubernetes Deployment](./kubernetes-deploy.md#deployment).

```yaml
livenessProbe:
  httpGet:
    path: /live
    port: http
  initialDelaySeconds: 10
  periodSeconds: 15
  timeoutSeconds: 3
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: http
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 2
  failureThreshold: 3

startupProbe:
  httpGet:
    path: /health
    port: http
  initialDelaySeconds: 0
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 12
```

### Probe Timing Summary

| Probe | Path | Initial Delay | Period | Timeout | Failures | Max startup time |
|---|---|---|---|---|---|---|
| Startup | `/health` | 0s | 5s | 3s | 12 | 60s |
| Liveness | `/live` | 10s | 15s | 3s | 3 | — |
| Readiness | `/ready` | 5s | 10s | 2s | 3 | — |

### Rationale

- **Startup probe** allows up to 60 seconds (`12 × 5s`) for the Next.js server to initialise. This is generous enough to cover cold starts, JIT compilation, and first-request compilation in production mode.
- **Liveness probe** starts after 10 seconds and checks every 15 seconds. Three consecutive failures (45 seconds of unresponsiveness) trigger a pod restart. The liveness endpoint does not check external dependencies, so transient K8s API or OIDC failures will not cause unnecessary restarts.
- **Readiness probe** starts after 5 seconds and checks every 10 seconds. A failing readiness probe removes the pod from the Service's endpoints but does **not** restart it. This allows the pod to recover without losing in-flight requests.

---

## Expected Response Codes

| Scenario | HTTP Status |
|---|---|
| Server is running and routes are reachable | `200 OK` |
| Server is starting up (Next.js not yet ready) | `404 Not Found` or connection refused |
| Server process has exited | Connection refused / timeout |

> **Note:** During the initial startup window, the Next.js server may return `404` for probe paths until route compilation is complete. The `startupProbe` with its generous `failureThreshold` accounts for this.

---

## Testing Probes Locally

```bash
# Start the dev server
npm run start:dev

# In another terminal:
curl -s http://localhost:3000/health | jq
curl -s http://localhost:3000/live
curl -s http://localhost:3000/ready
curl -s http://localhost:3000/healthz | jq
```

Expected output for `/health`:

```json
{
  "status": "OK",
  "uptime": 42.123,
  "timestamp": "2026-06-26T12:00:00.000Z"
}
```
