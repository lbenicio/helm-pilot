# Helm Releases

Helm Pilot manages Helm releases by directly reading and writing the Kubernetes Secrets that Helm uses as its release storage backend. This eliminates the need for the `helm` CLI or Helm SDK — all operations are performed via the K8s REST API.

---

## How Releases Are Discovered

Helm stores each release revision as a Kubernetes Secret of type `helm.sh/release.v1` with the label `owner=helm`. Helm Pilot discovers releases by querying the K8s API:

```
GET /api/v1/secrets?labelSelector=owner%3Dhelm
```

Optionally scoped to a namespace:

```
GET /api/v1/namespaces/{namespace}/secrets?labelSelector=owner%3Dhelm
```

**Endpoint:** `GET /api/k8s/releases?namespace={ns}`

The backend calls `callK8sApi` with the appropriately constructed URL, then iterates over each secret's `data.release` field to extract release metadata.

---

## Release Parsing

### The `parseHelmSecret` Function

Each Helm release secret contains a `data.release` field — a base64-encoded, gzip-compressed JSON payload. The `parseHelmSecret` function in `src/lib/helm.ts` handles decoding:

```
base64 → gunzip → JSON.parse
```

### Double-Encoding Handling

Some Helm versions or storage backends produce a double-layer encoding where the base64 content is itself another base64 string. The parser handles this gracefully:

1. **First attempt:** Decode base64 → gunzip → JSON.parse
2. **On failure (corrupt gzip):** Decode base64 → interpret as UTF-8 string → decode again as base64 → gunzip → JSON.parse
3. **Fallback:** Reject with the original error

```typescript
// Simplified logic
const buffer = Buffer.from(base64Data, 'base64');
zlib.gunzip(buffer, (err, decompressed) => {
  if (!err) {
    resolve(JSON.parse(decompressed.toString('utf-8')));
    return;
  }
  // Double-encoding fallback
  const innerBuffer = Buffer.from(buffer.toString('utf-8'), 'base64');
  zlib.gunzip(innerBuffer, (err2, decompressed2) => {
    if (err2) return reject(err2);
    resolve(JSON.parse(decompressed2.toString('utf-8')));
  });
});
```

### Release Object Structure

The decoded Helm release object has this shape:

```json
{
  "name": "my-release",
  "namespace": "default",
  "version": 3,
  "info": {
    "first_deployed": "2024-01-15T10:00:00Z",
    "last_deployed": "2024-01-20T14:30:00Z",
    "deleted": "",
    "description": "Upgrade complete",
    "status": "deployed",
    "notes": "1. Get the application URL..."
  },
  "chart": {
    "metadata": {
      "name": "nginx",
      "version": "15.4.2",
      "appVersion": "1.25.0",
      "description": "NGINX web server"
    },
    "templates": [],
    "values": {}
  },
  "config": {
    "replicaCount": 3,
    "service": { "type": "LoadBalancer", "port": 80 }
  },
  "manifest": "---\n# Source: nginx/templates/deployment.yaml\n..."
}
```

### Deduplication

Since Helm keeps one secret per revision, the same release appears multiple times in the secret list. The backend deduplicates by using a `Map<string, any>` keyed by `namespace/releaseName`. Only the highest-revision entry is kept:

```typescript
const key = `${decoded.namespace}/${decoded.name}`;
const existing = releasesMap.get(key);
if (!existing || existing.revision < decoded.version) {
  releasesMap.set(key, { name: decoded.name, ... });
}
```

---

## Release Lifecycle Operations

All lifecycle operations are performed by creating or modifying Helm release secrets in the cluster.

### Install

**Endpoint:** `POST /api/k8s/releases/install`

**Request body:**

```json
{
  "name": "my-nginx",
  "namespace": "default",
  "chartName": "nginx",
  "chartVersion": "15.4.2",
  "valuesYaml": "replicaCount: 3\nservice:\n  type: LoadBalancer\n  port: 80",
  "isUpgrade": false
}
```

**What happens:**

1. The `valuesYaml` string is parsed with `js-yaml` into a config object.
2. The backend queries existing release secrets to determine the next version number. If no secrets exist, version starts at 1.
3. A new Helm release payload is constructed with the provided chart metadata, config values, and current timestamp.
4. The payload is encoded via `encodeHelmRelease` (JSON → gzip → base64).
5. A new Kubernetes Secret is created with:
   - Name: `sh.helm.release.v1.{name}.v{version}`
   - Type: `helm.sh/release.v1`
   - Labels: `owner=helm`, `name={name}`, `status=deployed`, `version={version}`
   - Data: `release` field containing the encoded payload

### Upgrade (Edit Values)

**Endpoint:** `POST /api/k8s/releases/install` (same endpoint, with `isUpgrade: true`)

Upgrading a release increments the version number and creates a new secret with updated config values. The `description` field in `info` is set to `"Upgrade"` to distinguish it from an initial install.

From the UI, users edit the `values.yaml` in the Release Details panel and click "Save & Upgrade":

1. The current values are loaded into a YAML editor.
2. User modifies values and submits.
3. The same `releases/install` endpoint is called with `isUpgrade: true`.
4. The backend increments the version and creates a new secret.

**Version calculation:**

```typescript
const secrets = await callK8sApi(config,
  `${base}/namespaces/${namespace}/secrets?labelSelector=name%3D${name},owner%3Dhelm`);
let maxVersion = 0;
for (const s of secrets.items || []) {
  const parts = s.metadata?.name?.match(/\.v(\d+)$/);
  if (parts) maxVersion = Math.max(maxVersion, parseInt(parts[1]));
}
nextVersion = maxVersion + 1;
```

### Rollback

**Endpoint:** `POST /api/k8s/releases/:ns/:name/rollback`

**Request body:** `{ "revision": 2 }`

**What happens:**

1. The backend fetches all secrets for the release.
2. Finds the specific revision secret by matching the `version` label.
3. Decodes the target revision's release payload.
4. Sets the version to `maxVersion + 1` (rollback creates a new revision, it doesn't delete the old ones).
5. Updates `info.last_deployed` to the current time, `info.status` to `"deployed"`, and `info.description` to `"Rollback to v{revision}"`.
6. Creates a new secret with the rolled-back content at the new version.

> **Note:** Helm Pilot's rollback is implemented at the secret level — it takes the release configuration from the target revision and creates a new revision with it. This matches Helm's semantics where rollback creates a new release revision.

### Uninstall

**Endpoint:** `POST /api/k8s/releases/:ns/:name/uninstall`

**What happens:**

1. Queries all secrets for the release.
2. Sends a `DELETE` request for each secret individually:

```typescript
for (const s of secrets.items || []) {
  await callK8sApi(config,
    `${base}/namespaces/${ns}/secrets/${s.metadata.name}`,
    { method: 'DELETE' }
  ).catch(() => {});
}
```

> **Important:** Uninstalling through Helm Pilot **only removes the release secrets**. It does not delete the actual Kubernetes resources (Deployments, Services, etc.) that were created when the chart was installed. This is because Helm Pilot does not have access to the Helm chart templates to perform a proper `helm uninstall`.

### Restart

**Endpoint:** `POST /api/k8s/releases/:ns/:name/restart`

Triggers a rolling restart of all workloads belonging to a release by patching the `kubectl.kubernetes.io/restartedAt` annotation on Deployments, StatefulSets, and DaemonSets.

**What happens:**

1. For each workload kind (`deployments`, `statefulsets`, `daemonsets`):
   - Queries workloads matching the release name via `app.kubernetes.io/instance` label.
   - Sends a merge-patch to set the `restartedAt` annotation to the current timestamp:

```typescript
await callK8sApi(config,
  `/apis/apps/v1/namespaces/${ns}/${kind}/${item.metadata.name}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/merge-patch+json' },
    body: JSON.stringify({
      spec: {
        template: {
          metadata: {
            annotations: {
              'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
            }
          }
        }
      }
    }),
  });
```

The response includes the count of workloads that were restarted:

```json
{ "success": true, "message": "Restarted 3 workload(s)", "restarted": 3 }
```

---

## Release Detail View

**Endpoint:** `GET /api/k8s/releases/:ns/:name`

Returns comprehensive information about a specific release, including all revision history.

### Response Structure

```json
{
  "name": "my-nginx",
  "namespace": "default",
  "revision": 3,
  "updated": "2024-01-20T14:30:00Z",
  "status": "deployed",
  "chartName": "nginx",
  "chartVersion": "15.4.2",
  "appVersion": "1.25.0",
  "values": "replicaCount: 3\nservice:\n  type: LoadBalancer\n  port: 80\n",
  "manifest": "---\n# Source: nginx/templates/deployment.yaml\n...",
  "notes": "1. Get the application URL...",
  "history": [
    {
      "revision": 3,
      "updated": "2024-01-20T14:30:00Z",
      "status": "deployed",
      "chart": "nginx-15.4.2",
      "chartName": "nginx",
      "chartVersion": "15.4.2",
      "appVersion": "1.25.0",
      "description": "Upgrade complete"
    }
  ],
  "podCounts": {
    "total": 3,
    "running": 3,
    "pending": 0,
    "failed": 0
  },
  "k8sStatus": "healthy",
  "k8sStatusReason": "3/3 pods ready"
}
```

### How It Works

1. **Fetch release secrets:** Queries all secrets for the release by name in the given namespace.
2. **Decode all revisions:** Every secret's `data.release` is decoded to construct the history array.
3. **Sort by version:** Revisions are sorted descending (most recent first).
4. **Match pods:** The backend queries all pods in the namespace and matches them to the release using three strategies:
   - Pod label `release` matches the release name
   - Pod label `app.kubernetes.io/instance` matches the release name
   - Pod name starts with `{releaseName}-`
5. **Calculate pod status:** Counts running, pending, and failed pods. Sets `k8sStatus` to `"warning"` if any pods have failed, otherwise `"healthy"`.

### UI Tabs

The `ReleaseDetails` component provides five tabs:

| Tab | Content |
|---|---|
| **Overview** | Revision info, status badge, pod health, resource usage chart, action buttons |
| **History** | Revision timeline with expandable details (metadata, values, notes, manifest per revision) |
| **Values** | Editable YAML editor for release config; "Save & Upgrade" to submit changes |
| **Manifest** | Full rendered Kubernetes manifest for the current revision |
| **Security** | Antivirus/security scanner for the release |

---

## Bulk Operations

The Dashboard component supports bulk actions on multiple releases at once. Selected releases can be:

- **Bulk deleted** — Sends individual uninstall requests for each selected release.
- **Bulk rolled back** — Rolls back each selected release to a specified revision.
- **Bulk upgraded** — Applies a common values change across multiple releases.

These operations are batched from the frontend by sending parallel API requests for each selected release.

---

## Chart Deployment Wizard

The `InstallChartModal` component provides a two-step deployment wizard for installing new Helm releases from the Chart Store catalog.

### Step 1: Basic Configuration

Collects three required fields:

| Field | Description | Validation |
|---|---|---|
| **Release Name** | Helm release name | Lowercased, non-alphanumeric chars stripped |
| **Namespace** | Target Kubernetes namespace | Lowercased, non-alphanumeric chars stripped |
| **Chart Version** | Specific chart version (pre-filled with latest) | Free-form |

A blue info box suggests switching to Advanced mode for custom values.

### Step 2: Advanced Values Editor

A full-size YAML textarea for editing `values.yaml`. Features:

- Pre-populated with default values from the chart (or Helm Pilot defaults if none provided).
- "Format" button to normalize indentation.
- Monospace font, syntax-friendly sizing.
- Resizable, scrollable within the modal.

### Submission

The "Deploy" button calls `POST /api/k8s/releases/install` with `isUpgrade: false`. The modal shows success/error feedback and auto-closes on success after a 1.5s delay, triggering a dashboard refresh.

---

## Encoding Releases

### The `encodeHelmRelease` Function

Creating new release secrets requires encoding the release object back into the format Helm expects:

```
JSON.stringify → gzip → base64
```

```typescript
export function encodeHelmRelease(releaseObj: any): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const jsonStr = JSON.stringify(releaseObj);
      zlib.gzip(jsonStr, (err, buffer) => {
        if (err) return reject(err);
        resolve(buffer.toString('base64'));
      });
    } catch (e) {
      reject(e);
    }
  });
}
```

---

## Release Status Lifecycle

Helm releases go through the following statuses:

```
unknown → deployed → superseded
                  → failed
                  → uninstalling → uninstalled
                  → pending-install → pending-upgrade → pending-rollback
```

Helm Pilot primarily interacts with `deployed` and `superseded` statuses:

- **deployed** — The current active revision. Only one revision per release is `deployed`.
- **superseded** — Previous revisions that have been replaced by an upgrade or rollback.
- **failed** — A failed install/upgrade attempt. The release can be rolled back to a previous working revision.

---

## Namespace Quotas

The `/api/k8s/namespaces/:ns/quota` endpoint provides resource usage data per namespace:

**For `all` namespaces:** Returns hardcoded aggregate totals.

**For a specific namespace:** Queries pods, services, and secrets in the namespace and calculates:

- **CPU usage:** Sum of container CPU limits (defaulting to 250m per container)
- **Memory usage:** Estimated at 40% of CPU usage
- **Pod count:** Total pods in the namespace

```json
{
  "quotas": [
    { "name": "CPU", "resource": "cpu", "limit": 4000, "used": 1250, "unit": "millicores", "percentage": 31 },
    { "name": "Memory", "resource": "memory", "limit": 8192, "used": 500, "unit": "MiB", "percentage": 6 },
    { "name": "Pods", "resource": "pods", "limit": 20, "used": 8, "unit": "count", "percentage": 40 }
  ]
}
```

---

## Activity Log Integration

Release operations are logged to the activity feed. The `/api/k8s/activity` endpoint merges K8s native events with Helm Pilot actions:

- K8s events are fetched via `/api/v1/events?limit=30`
- Each event is normalized to a common format with `id`, `timestamp`, `type`, `severity`, `category`, `message`, and `user` fields
- Events are sorted by timestamp (most recent first)

---

## Limitations

- **No Helm SDK integration.** Helm Pilot mimics Helm's behavior at the secret level. It does not invoke `helm install` or `helm upgrade` — it creates the same secrets Helm would.
- **No template rendering.** The `manifest` field is stored but not generated by Helm Pilot. Charts installed through the web UI will have an empty manifest until a real Helm CLI renders them.
- **Uninstall does not delete resources.** Only release secrets are removed. To clean up workloads, use `kubectl delete` or `helm uninstall` separately.
- **No chart dependency resolution.** Helm Pilot treats charts as single units.
- **Single-revision rollback.** Rollback always targets a specific revision number.
