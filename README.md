# Helm Pilot

[![Dependabot Updates](https://github.com/lbenicio/helm-pilot/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/lbenicio/helm-pilot/actions/workflows/dependabot/dependabot-updates)

A high-performance, enterprise-grade Kubernetes release dashboard and Helm chart management system. Helm Pilot provides a centralized web-based interface for engineering and platform teams to monitor, deploy, upgrade, and audit Helm releases across multiple clusters with robust security and real-time operational visibility.

## Index

- [Features](#features)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
  - [Docker Compose](#docker-compose)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Documentation](#documentation)
- [License](#license)


## Key Features

- **Multi-Cluster Support** — Switch between configured clusters with latency and health indicators
- **Release Dashboard** — View, search, filter, and bulk-manage Helm releases across namespaces
- **Chart Store Catalog** — Browse and deploy from multiple Helm repos with auto-detection
- **Release Lifecycle** — Install, upgrade, rollback, restart, and uninstall with a two-step deploy wizard
- **Cluster Health** — Node inventory, control plane status, API latency, CPU/memory utilization
- **Live Event Stream** — Real-time feed of Kubernetes events and Helm operations with auto-refresh
- **Namespace Quotas** — Resource quota tracking and utilization per namespace
- **OIDC Authentication** — Secure login via any OIDC provider with group-based access control
- **K8s Impersonation** — Authenticate as a service account and impersonate OIDC users with group headers
- **Dark Mode** — Full light/dark theme with system preference detection
- **Mobile Responsive** — Bottom navigation bar, touch-optimized controls, PWA meta tags

## System Architecture

- **Frontend**: Next.js 16 App Router, React 19, Tailwind CSS 4, Recharts, Motion
- **Backend**: Next.js API routes, `openid-client` v6 for OIDC, `jose` for JWT sessions
- **Routing**: File-based under `src/app/` — pages, layouts, API routes, dynamic params
- **State**: React Context (`AppContext`) for session, clusters, theme, search, namespace

## Directory Structure

```
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout + metadata
│   │   ├── page.tsx                  # / (Dashboard)
│   │   ├── not-found.tsx             # Custom 404
│   │   ├── global-error.tsx          # Custom 500
│   │   ├── robots.ts                 # /robots.txt
│   │   ├── sitemap.ts                # /sitemap.xml
│   │   ├── charts/page.tsx           # /charts
│   │   ├── events/page.tsx           # /events
│   │   ├── health/page.tsx           # /health
│   │   ├── search/page.tsx           # /search?q=
│   │   ├── release/[namespace]/[name]/page.tsx
│   │   └── api/                      # API routes
│   │       ├── auth/url,callback,session,logout/
│   │       ├── k8s/[...path]/        # Catch-all K8s proxy
│   │       ├── repos/                # Repo CRUD + search + auto-detect
│   │       └── health,live,ready/
│   ├── components/                   # Shared React components
│   │   ├── AppShell.tsx              # Auth gate + layout wrapper
│   │   ├── Header.tsx                # Navbar + breadcrumbs
│   │   ├── MobileNav.tsx             # Mobile bottom navigation
│   │   ├── Providers.tsx             # AppProvider wrapper
│   │   ├── Dashboard.tsx             # Release management
│   │   ├── ReleaseDetails.tsx        # Release detail + actions
│   │   ├── RepoCatalog.tsx           # Chart browser + search
│   │   ├── InstallChartModal.tsx     # Two-step deploy wizard
│   │   ├── ClusterSelector.tsx       # Multi-cluster management
│   │   ├── ClusterHealthWidget.tsx   # Node/component health
│   │   ├── NamespaceQuotaWidget.tsx  # Resource quotas
│   │   ├── ResourceUsageChart.tsx    # CPU/memory metrics
│   │   ├── ActivityLog.tsx           # Event stream
│   │   ├── AntivirusScanner.tsx      # Manifest security scanner
│   │   ├── LoginScreen.tsx           # OIDC login
│   │   ├── ContextMenu.tsx           # Right-click menu
│   │   ├── TruncatedSegment.tsx      # Text truncation
│   │   └── Header.tsx                # Navigation + breadcrumbs
│   ├── contexts/
│   │   └── AppContext.tsx            # Shared state provider
│   ├── lib/
│   │   ├── session.ts                # JWT cookie sessions (jose)
│   │   ├── k8s.ts                    # K8s config + API caller
│   │   ├── helm.ts                   # Release parse/encode
│   │   ├── oidc.ts                   # openid-client v6
│   │   ├── logger.ts                 # ANSI color logger
│   │   └── repos.ts                  # In-memory repo store
│   ├── types/                        # TypeScript interfaces
│   └── styles/
│       └── index.css                 # Tailwind + fonts + scrollbars
├── public/
│   └── static/favicon/               # Multi-variant favicons
├── docs/                             # Full documentation
├── scripts/
│   └── docker-release.sh             # Multi-registry build + push
├── Dockerfile                        # Production build (standalone)
├── Dockerfile.dev                    # Development with hot-reload
├── docker-compose.yml                # Dev compose with volume mounts
├── next.config.ts                    # Next.js config + health rewrites
├── eslint.config.mjs                 # ESLint flat config + perfectionist
├── .prettierrc                       # Prettier config
├── postcss.config.mjs                # Tailwind CSS PostCSS plugin
├── tsconfig.json                     # TypeScript config
└── package.json
```

## Quick Start

### Prerequisites

- Node.js 24+
- npm 11+

### Setup

```bash
git clone https://github.com/lbenicio/helm-pilot.git
cd helm-pilot
npm ci
cp .env.example .env
# Edit .env with your OIDC and K8s credentials
npm run start:dev
```

Open `http://localhost:3000`.

### Docker Compose

```bash
docker compose up --build -d
```

## Configuration

See [docs/getting-started/configuration.md](docs/getting-started/configuration.md) for the complete environment variables reference.

| Variable | Required | Description |
|---|---|---|
| `OIDC_CLIENT_ID` | Yes | OIDC client ID |
| `OIDC_CLIENT_SECRET` | Yes | OIDC client secret |
| `OIDC_ISSUER_URL` | Yes | OIDC issuer discovery URL |
| `K8S_API_URL` | No | Default cluster API URL |
| `K8S_TOKEN` | No | SA token for impersonation |
| `K8S_CLUSTER_NAME` | No | Default cluster display name |
| `LOG_LEVEL` | No | `error` / `warn` / `info` / `debug` |
| `OIDC_ALLOWED_GROUPS` | No | Comma-separated allowed groups |

## Scripts

| Script | Description |
|---|---|
| `npm run start:dev` | Start Next.js dev server |
| `npm run start:prod` | Start production server |
| `npm run build:prod` | Production build |
| `npm run type:check` | TypeScript type checking |
| `npm run lint:check` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format:check` | Prettier check |
| `npm run format:fix` | Prettier format |
| `npm run docker:build` | Build production image |
| `npm run docker:up` | Start dev containers |
| `npm run docker:release` | Build + push multi-registry |

## Documentation

Full documentation in [`docs/`](docs/README.md) covering getting started, architecture, authentication, Kubernetes, deployment, and development.

## License

GPL-3.0-only — see [LICENSE.txt](LICENSE.txt).
