# Configuration

Helm Pilot is configured entirely through environment variables. No configuration files, databases, or external services are required beyond your OIDC identity provider and Kubernetes API server.

Create a `.env` file at the project root. You can start from the provided template:

```bash
cp .env.example .env
```

---

## Variable Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_URL` | **Yes** | `http://localhost:3000` | The full URL where Helm Pilot is accessible. Used for constructing OIDC redirect URIs, session cookie domain logic, and self-referential links. Must match the OIDC client's configured redirect URL prefix (the `/api/auth/callback` path is appended automatically). |
| `OIDC_CLIENT_ID` | **Yes** | _(none)_ | The client identifier registered with your OIDC provider. Without this, the auth endpoint returns a 500 error. |
| `OIDC_CLIENT_SECRET` | **Yes** | _(none)_ | The client secret registered with your OIDC provider. Used during the authorization code grant exchange. |
| `OIDC_ISSUER_URL` | **Yes** | _(none)_ | The issuer URL of your OIDC provider (e.g. `https://pocketid.lan`). Used to perform OIDC discovery (`.well-known/openid-configuration`) and obtain the authorization, token, and userinfo endpoints automatically. |
| `OIDC_SCOPES` | No | `openid profile email` | Space-separated list of OIDC scopes to request. The `openid` scope is always prepended if missing (required by the OIDC spec). Add `groups` to enable group-based access control. |
| `OIDC_SKIP_TLS_VERIFY` | No | `false` | Set to `true` to bypass TLS certificate validation for the OIDC provider **and** the Kubernetes API server. This sets `NODE_TLS_REJECT_UNAUTHORIZED=0` globally. Intended for development environments or sandboxes with self-signed certificates. **Never enable this in production.** |
| `OIDC_ALLOWED_GROUPS` | No | _(none — allow all)_ | Comma-separated list of OIDC groups permitted to access Helm Pilot. When set, a user must belong to at least one of the listed groups after authentication. Matching is case-insensitive. Example: `admin,platform-eng`. Leave empty to grant access to any authenticated user. |
| `K8S_API_URL` | No | _(none)_ | The default Kubernetes API server URL (e.g. `https://192.168.0.145:6443`). When set, this cluster is pre-configured and appears automatically in the UI without manual entry. Leave empty if you plan to connect clusters through the UI only. |
| `K8S_TOKEN` | No | _(none)_ | A Kubernetes service account bearer token used for **impersonation**. When configured, the server authenticates to the K8s API as this service account and impersonates the OIDC-authenticated user via the `Impersonate-User` and `Impersonate-Group` headers. The service account must have the `impersonate` verb on `users`, `groups`, and `serviceaccounts` resources. Leave empty to pass the OIDC user's token directly. |
| `K8S_CLUSTER_NAME` | No | `Default Cluster` | A human-readable label for the default cluster defined by `K8S_API_URL`. Shown in the cluster selector UI dropdown. |
| `K8S_CA_CERT` | No | _(none)_ | A PEM-encoded CA certificate for verifying the Kubernetes API server's TLS certificate. Only needed when the API server uses a custom or self-signed CA that is not in the system trust store. Can also be passed per-request via the `x-k8s-ca-cert` HTTP header. |
| `LOG_LEVEL` | No | `info` | Controls log verbosity. Valid values (case-sensitive): `error`, `warn`, `info`, `debug`. Set to `debug` during development to see OIDC flow details and API request paths. |
| `SESSION_SECRET` | No | `helm-pilot-session-secret-key-2024` | The secret key used to sign and verify JWT session cookies. The session is a HS256-signed JWT with a 24-hour expiry stored in an `httpOnly`, `sameSite: lax` cookie named `helm_session`. **Change this to a strong, random value in production.** A good value can be generated with `openssl rand -hex 32`. |

---

## Example `.env` — Development with Pocket ID

```bash
# Application
APP_URL="http://localhost:3000"
LOG_LEVEL="debug"

# OIDC (Pocket ID)
OIDC_CLIENT_ID="f9b09bfb-969a-420f-90d6-2efdfec00723"
OIDC_CLIENT_SECRET="your-client-secret"
OIDC_ISSUER_URL="https://pocketid.lan"
OIDC_SCOPES="openid profile email groups"
OIDC_ALLOWED_GROUPS="admin"
OIDC_SKIP_TLS_VERIFY="true"
```

## Example `.env` — Production with External OIDC & K8s

```bash
# Application
APP_URL="https://helm-pilot.example.com"
LOG_LEVEL="info"
SESSION_SECRET="a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0"

# OIDC (Okta / Keycloak / Authentik / etc.)
OIDC_CLIENT_ID="0oa1abc2def3GHI4jk5"
OIDC_CLIENT_SECRET="your-production-client-secret"
OIDC_ISSUER_URL="https://sso.example.com/realms/production"
OIDC_SCOPES="openid profile email groups"
OIDC_ALLOWED_GROUPS="platform-engineering,sre"
OIDC_SKIP_TLS_VERIFY="false"

# Kubernetes (service account impersonation)
K8S_API_URL="https://k8s-api.prod.example.com:6443"
K8S_CLUSTER_NAME="Production"
K8S_TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6..."
```

---

## Environment-Specific Behaviour

| Behaviour | Condition |
|---|---|
| Session cookie `secure` flag | Set to `true` only when `NODE_ENV=production` |
| OIDC state cookie `secure` flag | Set to `true` only when `NODE_ENV=production` |
| Login screen bypass | The login screen is a React component; there is no local credential override. All authentication goes through OIDC. |
| TLS verification | Controlled by `OIDC_SKIP_TLS_VERIFY`. When `true`, both OIDC and K8s API TLS checks are disabled globally via `NODE_TLS_REJECT_UNAUTHORIZED=0`. |

---

## Notes

- **No hot-reload of environment variables.** Changes to `.env` require a server restart (`npm run start:dev` or `docker compose restart`).
- **The `dotenv` package** loads `.env` automatically at startup. No import or manual `config()` call is needed.
- **Kubernetes cluster configuration can be set at runtime** through the UI in addition to the `K8S_*` environment variables. The environment variables provide a default cluster that is always available.
- **The `K8S_TOKEN` impersonation model** is the recommended approach for production because it avoids giving end-user Kubernetes credentials to the Helm Pilot process and enables fine-grained RBAC via the service account's impersonation policy.
