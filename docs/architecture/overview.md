# System Architecture

## Runtime model

Helm Pilot runs as a **single Node.js process** using **Next.js 16** with the **App Router**. Both the server-side API layer and the client-side React application execute inside the same process. There is no separate backend service — the Next.js server handles HTTP requests for pages, static assets, and API routes.

```
┌──────────────────────────────────────────────────────┐
│  Next.js 16 Process (localhost:3000 or $APP_URL)     │
│                                                      │
│  ┌─────────────────────┐  ┌───────────────────────┐  │
│  │  React SPA (client) │  │  API Routes (server)  │  │
│  │  - AppShell         │  │  - /api/auth/*        │  │
│  │  - Header           │  │  - /api/k8s/[...path] │  │
│  │  - MobileNav        │  │  - /api/repos/*       │  │
│  │  - page.tsx files   │  │  - /api/health        │  │
│  └─────────┬───────────┘  └───────────┬───────────┘  │
│            │                          │              │
│            └────── React Context ─────┘              │
│                      (AppContext)                     │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  lib/ modules (shared between client & server) │  │
│  │  session.ts  k8s.ts  helm.ts  oidc.ts         │  │
│  │  logger.ts   repos.ts                          │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  In-memory state:                                    │
│  - Helm repo registry (repos.ts)                     │
│  - OIDC issuer discovery cache (oidc.ts)             │
│  - Chart search cache (API route / repos search)     │
└──────────────────────────────────────────────────────┘
```

## Directory structure

```
src/
├── app/                      # App Router entry point
│   ├── layout.tsx            # Root layout (HTML shell, metadata, Providers)
│   ├── page.tsx              # Home page (/ → Dashboard)
│   ├── charts/page.tsx       # /charts → Repo catalog
│   ├── events/page.tsx       # /events → Activity log
│   ├── health/page.tsx       # /health → Cluster health
│   ├── search/page.tsx       # /search?q= → Global search
│   ├── release/[namespace]/[name]/page.tsx  # Release detail
│   └── api/                  # API route handlers
│       ├── auth/             # OIDC authentication
│       ├── k8s/[...path]/    # K8s proxy (catch-all)
│       ├── repos/            # Helm repo CRUD
│       ├── health/           # Application health
│       ├── live/             # Liveness probe
│       └── ready/            # Readiness probe
├── components/               # React components
│   ├── AppShell.tsx          # Auth gate + layout wrapper
│   ├── Header.tsx            # Top navigation bar
│   ├── MobileNav.tsx         # Bottom tab bar (mobile)
│   ├── Providers.tsx         # Context provider wrapper
│   ├── Dashboard.tsx         # Release dashboard
│   ├── ReleaseDetails.tsx    # Single release view
│   ├── RepoCatalog.tsx       # Chart repository browser
│   ├── ClusterSelector.tsx   # K8s cluster picker
│   └── ...                   # Utility components
├── contexts/
│   └── AppContext.tsx         # Global React Context
├── lib/                       # Shared library modules
│   ├── session.ts             # JWT session cookies
│   ├── k8s.ts                 # K8s API client
│   ├── helm.ts                # Helm release serialization
│   ├── oidc.ts                # OIDC client (openid-client v6)
│   ├── logger.ts              # Structured console logger
│   └── repos.ts               # In-memory Helm repo store
├── types/                     # TypeScript type definitions
└── styles/                    # Global CSS
```

## Component tree

The React component tree is assembled from the root layout down:

```
layout.tsx (RootLayout)
└── Providers
    └── AppProvider (AppContext — React Context)
        └── AppShell
            ├── [loading]       → Spinner (while session loads)
            ├── [unauthenticated] → LoginScreen
            └── [authenticated]
                ├── Header
                │   ├── Logo + title
                │   ├── Desktop nav tabs
                │   ├── Global search input
                │   ├── ClusterSelector
                │   ├── Dark mode toggle
                │   └── User info + logout
                ├── Breadcrumb bar
                ├── <main>  {page content}
                │   ├── Dashboard       (/)
                │   ├── RepoCatalog     (/charts)
                │   ├── ReleaseDetails  (/release/:ns/:name)
                │   ├── ActivityLog     (/events)
                │   ├── ClusterHealth   (/health)
                │   └── Search          (/search)
                └── MobileNav (bottom tabs, md+ hidden)
```

### Key components

| Component | Responsibility |
| --- | --- |
| `Providers` | Wraps the app in `AppProvider` (React Context) and `AppShell`. |
| `AppShell` | Session gate. Checks auth on mount; renders `LoginScreen` when unauthenticated, the full app shell when authenticated. |
| `Header` | Sticky top bar with nav tabs, global search (`/search?q=`), cluster selector, dark-mode toggle, user display, and logout button. |
| `MobileNav` | Fixed bottom tab bar visible on screens below `md` breakpoint. Links to Dashboard, Charts, Events, Health. |
| `Dashboard` | Home page showing the full release list grouped by namespace. |
| `ReleaseDetails` | Detail view for a single release (`/release/:ns/:name`) with revision history, pod counts, values, manifest, and rollback/restart/uninstall actions. |
| `RepoCatalog` | Chart store catalog (`/charts`). Lists charts from registered Helm repos with search and install capabilities. |

## Shared state (AppContext)

Global application state is managed via a single **React Context** (`AppContext`):

| State | Type | Persistence |
| --- | --- | --- |
| `session` | `UserSession \| null` | Fetched from `/api/auth/session` |
| `loadingSession` | `boolean` | — |
| `clusters` | `K8sCluster[]` | `localStorage` |
| `activeCluster` | `K8sCluster \| null` | `localStorage` |
| `isDarkMode` | `boolean` | `localStorage` |
| `globalSearchQuery` | `string` | Ephemeral |
| `selectedNamespace` | `string` | Ephemeral (defaults to `"all"`) |

The context also exposes action functions: `checkSession`, `handleLogout`, `handleAddCluster`, `handleRemoveCluster`, `handleSelectCluster`, and setters for `isDarkMode`, `globalSearchQuery`, and `selectedNamespace`.

## In-memory state modules

### `repos.ts` — Helm repo registry

A module-level array (`repos`) holds the list of registered Helm chart repositories. The registry survives for the lifetime of the Node.js process and is lost on restart.

```ts
// in-memory store
let repos: { name: string; url: string }[] = [];
```

Operations: `getRepos()`, `addRepo(repo)`, `removeRepo(name)`. A separate `Map`-based `searchCache` lives inside the repo search API route handler (not exported from `repos.ts`).

### `oidc.ts` — OIDC issuer cache

The OIDC issuer discovery document (`openid-configuration`) is cached in a module-level variable:

```ts
let cachedConfig: oidc.Configuration | null = null;
```

This avoids re-fetching the discovery document on every auth URL request. The cache is invalidated only on process restart.

### K8s API route — chart search cache

The `/api/repos/search` route handler maintains a local `Map<string, { charts: any[]; fetchedAt: number }>` cache with a **10-minute TTL** (600 000 ms) to avoid repeatedly fetching Helm repository index files.

## Library modules

### `session.ts`

Manages JWT-based session cookies using the [`jose`](https://github.com/panva/jose) library (v6).

- `getSession(request)` — Verifies and decodes the `helm_session` cookie; returns `SessionUser | null`.
- `setSession(user)` — Signs a JWT with the user payload, sets it as an `HttpOnly` cookie with a **24-hour expiry**, and returns a redirect response to `/`.
- `clearSession()` — Clears the session cookie and returns a JSON success response.

The signing secret is `process.env.SESSION_SECRET` (defaults to a hardcoded fallback for development).

### `k8s.ts`

Kubernetes API client with impersonation support.

- `getK8sConfig(request)` — Resolves the K8s API configuration from the request headers (`x-k8s-api-url`, `x-k8s-ca-cert`) or environment variables (`K8S_API_URL`, `K8S_CA_CERT`). When `K8S_TOKEN` is set (service-account mode), it enables **user impersonation** via the `Impersonate-User` and `Impersonate-Group` headers using the session email and OIDC groups.
- `callK8sApi(config, path, options)` — Low-level fetch wrapper that constructs the URL, attaches `Authorization: Bearer`, and (when applicable) impersonation headers. Returns parsed JSON.

### `helm.ts`

Helm release data serialization. Helm stores release metadata as base64-encoded, gzip-compressed JSON inside Kubernetes Secrets.

- `parseHelmSecret(base64Data)` — Decodes and decompresses Helm release data from a Secret's `data.release` field.
- `encodeHelmRelease(releaseObj)` — Compresses and encodes a release object back into the base64+gzip format for storage.

### `oidc.ts`

OIDC authentication client built on [`openid-client`](https://github.com/panva/openid-client) v6.

- `generateState()` — Generates a random state value for CSRF protection.
- `getAuthorizationUrl(redirectUri, scope, state)` — Builds the authorization URL for the configured OIDC provider.
- `handleCallback(redirectUri, params, expectedState)` — Exchanges the authorization code for tokens.
- `fetchUserInfo(accessToken)` — Fetches user info from the provider's `userinfo_endpoint`.

TLS verification can be bypassed via `OIDC_SKIP_TLS_VERIFY=true`.

### `logger.ts`

A lightweight console logger with ANSI color support and configurable log level.

- Levels: `error`, `warn`, `info`, `debug`
- Configured via `LOG_LEVEL` environment variable (defaults to `info`)
- Each log line is prefixed with a dimmed ISO timestamp

## Environment variables

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Public URL of the application (used for OIDC redirect URI) |
| `SESSION_SECRET` | Secret key for signing session JWTs |
| `OIDC_ISSUER_URL` | OIDC provider issuer URL |
| `OIDC_CLIENT_ID` | OIDC client ID |
| `OIDC_CLIENT_SECRET` | OIDC client secret |
| `OIDC_SCOPES` | Requested OIDC scopes (default: `openid profile email`) |
| `OIDC_ALLOWED_GROUPS` | Comma-separated list of groups allowed to log in |
| `OIDC_SKIP_TLS_VERIFY` | Bypass TLS verification for OIDC endpoints |
| `K8S_API_URL` | Kubernetes API server base URL |
| `K8S_CA_CERT` | Kubernetes CA certificate (PEM) |
| `K8S_TOKEN` | Service account token (enables impersonation mode) |
| `K8S_CLUSTER_NAME` | Display name for the default cluster |
| `LOG_LEVEL` | Logging level (`error`, `warn`, `info`, `debug`) |
