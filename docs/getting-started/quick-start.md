# Quick Start

Follow this guide to go from a fresh checkout to deploying your first Helm chart in under five minutes.

---

## Overview

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ 1. Clone &   │────▶│ 2. Configure    │────▶│ 3. Start the     │
│    Install   │     │    .env (OIDC)  │     │    dev server    │
└─────────────┘     └─────────────────┘     └──────────────────┘
                                                     │
                                                     ▼
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ 6. Deploy a │◀────│ 5. Connect a    │◀────│ 4. Log in via    │
│    Chart    │     │    Cluster      │     │    OIDC          │
└─────────────┘     └─────────────────┘     └──────────────────┘
```

---

## Step 1: Clone and Install

```bash
git clone https://github.com/lbenicio/helm-pilot.git
cd helm-pilot
npm ci
```

This installs all dependencies from the lockfile. You should see output ending with a summary of installed packages.

---

## Step 2: Configure the Environment

Create your `.env` file from the template:

```bash
cp .env.example .env
```

### Minimal OIDC Configuration

Edit `.env` and set these four variables to match your identity provider:

```bash
APP_URL="http://localhost:3000"
OIDC_CLIENT_ID="your-client-id"
OIDC_CLIENT_SECRET="your-client-secret"
OIDC_ISSUER_URL="https://your-oidc-provider.com"
OIDC_SCOPES="openid profile email"
```

### Pocket ID Example

If you use [Pocket ID](https://pocket-id.org), the configuration looks like this:

```bash
APP_URL="http://localhost:3000"
OIDC_CLIENT_ID="f9b09bfb-969a-420f-90d6-2efdfec00723"
OIDC_CLIENT_SECRET="LliryN2YKVZKSjcp1a8fIDzfwLPYoR1L"
OIDC_ISSUER_URL="https://pocketid.lan"
OIDC_SCOPES="openid profile email groups"
OIDC_ALLOWED_GROUPS="admin"
OIDC_SKIP_TLS_VERIFY="true"
```

### Keycloak / Okta / Authentik Example

```bash
APP_URL="http://localhost:3000"
OIDC_CLIENT_ID="helm-pilot"
OIDC_CLIENT_SECRET="abc123def456ghi789"
OIDC_ISSUER_URL="https://sso.example.com/realms/my-realm"
OIDC_SCOPES="openid profile email groups"
OIDC_ALLOWED_GROUPS="engineers,admin"
```

### Full Configuration with Default Kubernetes Cluster

To pre-configure a Kubernetes cluster so it appears automatically after login, add these lines:

```bash
K8S_API_URL="https://your-k8s-api.example.com:6443"
K8S_CLUSTER_NAME="staging"
K8S_TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6..."
```

> **Note:** `K8S_TOKEN` enables service account impersonation. If omitted, Helm Pilot passes the OIDC user's bearer token directly to the Kubernetes API. See the [Configuration](./configuration.md) reference for details.

---

## Step 3: Start the Development Server

```bash
npm run start:dev
```

You should see output similar to:

```
[INFO]  ▲ Next.js 16.x
[INFO]  - Local:        http://localhost:3000
```

Leave this process running in your terminal. Open **http://localhost:3000** in a browser.

---

## Step 4: Log In via OIDC

1. Open `http://localhost:3000` — you will see the Helm Pilot login screen.
2. Click the **"Sign in with OIDC"** button.
3. You will be redirected to your identity provider's login page.
4. Authenticate with your credentials.
5. If `OIDC_ALLOWED_GROUPS` is configured, your OIDC groups are validated against the allowlist.
6. On success, you are redirected back to the Helm Pilot dashboard.

**What happens behind the scenes:**
- The frontend calls `/api/auth/url` to obtain the OIDC authorization URL with a cryptographically random `state` parameter.
- After the provider redirects back, `/api/auth/callback` exchanges the authorization code for tokens, fetches userinfo, validates group membership, and sets a signed JWT session cookie (`helm_session`).
- The session cookie is `httpOnly`, has a 24-hour lifetime, and is validated on every API request.

### Troubleshooting Login

| Symptom | Likely Cause |
|---|---|
| "OIDC not configured" (500 error) | `OIDC_CLIENT_ID` or `OIDC_CLIENT_SECRET` is missing from `.env` |
| Redirect URI mismatch | The OIDC client's redirect URI must include `/api/auth/callback` — e.g. `http://localhost:3000/api/auth/callback` |
| "Access denied: unauthorized groups" (403) | Your OIDC user's groups do not match any entry in `OIDC_ALLOWED_GROUPS`. Remove the restriction or add your group. |
| TLS / certificate error | Set `OIDC_SKIP_TLS_VERIFY=true` for development environments with self-signed certs |
| Token exchange failed | Verify `OIDC_CLIENT_SECRET` is correct and the issuer URL is reachable from the server |

---

## Step 5: Connect a Kubernetes Cluster

After logging in, you need to connect Helm Pilot to a Kubernetes cluster.

### Option A: Pre-configured Cluster (from `.env`)

If you set `K8S_API_URL` in your `.env`, the cluster appears automatically in the cluster selector at the top of the dashboard. Select it and Helm Pilot immediately begins fetching release data.

### Option B: Connect via the UI

1. Click the cluster selector dropdown in the top navigation bar.
2. Select **"Add Cluster"** or enter a cluster API URL.
3. Enter the Kubernetes API server URL (e.g. `https://192.168.0.145:6443`).
4. Optionally provide:
   - A **bearer token** for authentication
   - A **CA certificate** (PEM format) if the API server uses a self-signed certificate
5. Click **Connect**.

Helm Pilot will display cluster health information: node inventory, control plane component status, API latency, and resource utilisation.

> **Using a service account with impersonation:** Create a `ClusterRole` that grants the `impersonate` verb on `users`, `groups`, and `serviceaccounts`, bind it to a service account, and use that service account's token as `K8S_TOKEN`. The server then impersonates each OIDC-authenticated user, preserving Kubernetes RBAC at the user level.

---

## Step 6: Deploy Your First Chart

### Browse the Catalog

1. Navigate to the **"Chart Store"** tab in the UI.
2. You will see pre-configured repositories (Bitnami, Prometheus Community, Grafana, HashiCorp).
3. Use the search bar to find charts by name or keyword.
4. Click the **"Add Repository"** button to add custom Helm repositories.

### Install a Chart

1. Click on a chart (e.g. **nginx** from Bitnami).
2. Review the chart details: available versions, app version, and description.
3. Click **"Install"**.
4. Fill in the installation form:
   - **Release name** — a unique name for this deployment
   - **Namespace** — the target Kubernetes namespace
   - **Chart version** — select from the dropdown
   - **Values** — optionally provide custom YAML values to override chart defaults
5. Click **"Deploy"**.

```yaml
# Example custom values for nginx
service:
  type: ClusterIP
  port: 80
replicaCount: 2
resources:
  limits:
    memory: "256Mi"
    cpu: "200m"
```

6. Helm Pilot creates a Helm release by creating the appropriate Kubernetes Secret in the target namespace.
7. The release appears in the **"Releases"** dashboard with its status (**deployed**, **pending**, **failed**, etc.).

### Manage the Release

From the Releases dashboard, click on a release to access its detail view where you can:

- **Inspect** — view the current values, rendered manifests, and release metadata
- **Upgrade** — change chart version or customise values
- **Rollback** — revert to any previous revision
- **Restart** — trigger a rolling restart of the workload's pods
- **Uninstall** — remove the release and (optionally) its associated resources

---

## Verification Checklist

After completing the quick start, verify each item:

- [ ] Dev server starts without errors (`npm run start:dev`)
- [ ] Login screen loads at `http://localhost:3000`
- [ ] OIDC authentication completes and redirects to the dashboard
- [ ] Session persists across page reloads (the 24-hour cookie)
- [ ] Kubernetes cluster connects and shows node/health data
- [ ] Helm repositories are listed in the Chart Store
- [ ] A chart can be installed and appears in the Releases dashboard
- [ ] Chart search returns relevant results

---

## Next Steps

- Read the full [Configuration](./configuration.md) reference for all environment variables
- Set up [authentication](../authentication/README.md) with your specific OIDC provider
- Learn about the [Kubernetes integration](../kubernetes/README.md) and impersonation model
- Explore the [architecture](../architecture/README.md) to understand how Helm Pilot works internally
- Follow the [deployment guide](../deployment/README.md) for production set-up
