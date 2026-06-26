# Changelog

All notable changes to this repository will be documented in this file.

The format is based on "Keep a Changelog" and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.6] - 2026-06-26

### Added

- feat(deps): add react-router-dom dependency
- feat(scripts): add automated release script and changelog generator
- feat(linting): add ESLint, Prettier, and sort-imports config
- feat(changelog): update to v0.2.2 with new pages and fixes
- feat(app): add events and health monitoring pages
- feat(search): add global search page with Enter-to-search from navbar
- feat(api): restructure repo endpoints and add auto-detect
- feat(api): add health endpoints and Helm release management

### Changed

- refactor(api): remove unused imports and variables

### Fixed

- fix(api): mark unused variables with underscore prefix

### Documentation

- docs(readme): update npm script commands to use namespaced naming
- docs(changelog): add v0.2.4 release notes

### Chore

- chore(eslint): ignore caught and unused vars starting with underscore
- chore(helm-pilot): bump version to 0.2.5
- chore(package): update docker commands to use image subcommand
- chore(helm-pilot): bump version to 0.2.3
- chore(deps): update npm dependencies and add update scripts
- chore(gitignore): add .next directory to ignore file

### Misc

- style(MobileNav): reorder imports and update min sizes
- remove .next stuff
- bootstrap repository

## [0.2.4] - 2026-06-26

### Added
- **Mobile bottom navigation** — fixed 4-tab bar (Home/Charts/Events/Health) with 48px touch targets, visible on `md:hidden`
- `theme-color` meta tags for mobile browser chrome (light/dark mode)
- Apple PWA meta tags (`apple-mobile-web-app-capable`, `status-bar-style`)
- Safe area padding for notched devices (`safe-area-bottom`)
- **ESLint** flat config with TypeScript rules (`eslint.config.mjs`)
- **Prettier** config (`.prettierrc`) — single quotes, trailing commas, 140 char width
- **eslint-plugin-perfectionist** — automatic import/export/named-import sorting
- `lint:check`, `lint:fix`, `format:check`, `format:fix` npm scripts

### Changed
- Mobile content padding reduced to `px-4`, bottom padding increased to `pb-20` to clear nav bar
- Desktop nav hidden on mobile; mobile bottom nav hidden on desktop (`md:` breakpoint)
- All source files formatted with Prettier and ESLint-fixed

## [0.2.3] - 2026-06-26

### Changed
- **openid-client v5 → v6 migration** — rewritten OIDC module for v6 API (`discovery`, `buildAuthorizationUrl`, `authorizationCodeGrant`, `fetchUserInfo`, `randomState`)
- OIDC callback path moved to `/api/auth/callback` (Next.js convention)
- Remainder of Express endpoints migrated to Next.js API routes (quota, usage, test, release CRUD)

### Fixed
- Repos `DELETE /api/repos/:name` route properly handles dynamic params
- Repos search and auto-detect endpoints restored with caching
- `redirect_uri` mismatch error resolved — OIDC callback now at `/api/auth/callback`
- Unused Vite/Express dependencies cleaned from `package.json`

## [0.2.2] - 2026-06-26

### Added
- **Live Events page** (`/events`) — real-time stream of K8s events and Helm operations with auto-refresh, severity counters, and color-coded rows
- **Cluster Health page** (`/health`) — detailed diagnostics with node inventory table, control plane component status, CPU/memory gauges, and API latency
- Navbar links for Events, Health, and Search with active-state highlighting and breadcrumbs
- Package version in navbar reads from `package.json` dynamically
- All repos API routes migrated: `/api/repos/add`, `/api/repos/[name]` (DELETE), `/api/repos/search`, `/api/repos/auto-detect`

### Fixed
- K8s API TLS bypass (`NODE_TLS_REJECT_UNAUTHORIZED`) now applies to all K8s calls, not just OIDC
- Release detail, rollback, uninstall, restart, quota, usage, and test endpoints added to K8s catch-all route
- Dockerfile updated for Next.js standalone output with health probe rewrites

## [0.2.1] - 2026-06-26

### Added
- Global search page at `/search?q=...` with Enter-to-search from navbar
- Kubernetes health probes: `/health`, `/healthz`, `/live`, `/ready` and API variants
- Version in navbar reads from `package.json` instead of hardcoded string
- Multi-variant favicon support from `public/static/favicon/`

### Fixed
- Double base64 encoding in Helm secret parsing
- `x-k8s-token` header no longer sends literal `"undefined"` string
- Connection test error messages now support dark mode

## [0.2.0] - 2026-06-26

### Changed
- **Full migration to Next.js App Router** (replaced Vite + Express)
- File-based routing: `src/app/page.tsx` → `/`, `src/app/charts/page.tsx` → `/charts`, `src/app/release/[namespace]/[name]/page.tsx` → `/release/:ns/:name`
- Express server replaced with Next.js API routes under `src/app/api/`
- JWT cookie-based sessions via `jose` (replaces express-session)
- In-memory state (`repos`, `helmOperations`, `oidcIssuer`) retained across requests

### Added
- OIDC group-based access control via `OIDC_ALLOWED_GROUPS` env var
- React Router replaced with Next.js App Router for proper URL-based navigation
- Breadcrumbs synced to URL path (not query params)

### Removed
- Vite, `react-router-dom`, `vite-plugin-pages`, Express, `express-session`, `cookie-parser` dependencies

## [0.1.3] - 2026-06-26

### Added
- Release restart endpoint (`POST /api/k8s/releases/:ns/:name/restart`) — triggers rolling restart of all workloads
- Release management actions: edit values, upgrade, rollback, uninstall, restart from release detail page
- Helm repository auto-detection (`POST /api/repos/auto-detect`) — scans cluster for installed charts and matches repos
- OIDC impersonation with group headers for K8s RBAC

### Fixed
- Redirect URI construction strips port from host header
- Explicit `redirect_uri` in OIDC authorization URL
- Issuer discovery cached, Client rebuilt per request to avoid redirect URI mismatches

## [0.1.2] - 2026-06-25

### Added
- Default Kubernetes cluster from env vars (`K8S_API_URL`, `K8S_CLUSTER_NAME`)
- `OIDC_SKIP_TLS_VERIFY` env var for self-signed OIDC providers
- `OIDC_ALLOWED_GROUPS` for group-based authorization

### Changed
- OIDC token now used as K8s bearer token (direct or via impersonation)
- K8s API calls use impersonation when `K8S_TOKEN` is set

## [0.1.1] - 2026-06-25

### Added
- Centralized logger with `LOG_LEVEL` env var (`error`, `warn`, `info`, `debug`)
- ANSI color-coded log output with timestamps
- Full-width layout (removed centered container)

### Removed
- All mock/demo/sandbox data — every endpoint now requires a real K8s cluster
- Default sample Helm releases, simulated events, seed-based quota fallbacks
- "Sandbox Cluster" UI elements from cluster selector and dashboard

### Fixed
- Silent `.catch()` fallbacks that masked K8s API errors — now propagate properly
- Summary stat cards show `—` instead of `0` on error

## [0.1.0] - 2026-06-25

### Added
- Initial release — Helm Pilot web application
- OIDC/OAuth2 authentication via Pocket ID
- Kubernetes cluster health monitoring (nodes, components, latency)
- Helm release listing, detail view, history
- Chart Store Catalog with repository management
- Namespace resource quotas widget
- Resource usage metrics (CPU/Memory) with historical charts
- Activity log with K8s events
- Dark mode support
- Cluster selector with multiple cluster profiles
