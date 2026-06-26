# Helm Pilot Documentation

Helm Pilot is a web-based Helm Chart and Kubernetes Release Manager with OIDC authentication. It provides a full-stack dashboard to browse Helm repositories, track releases, manage live clusters, and inspect cluster health — all through a modern, responsive UI.

## Features

- **OIDC/OAuth2 Authentication** — Secure login via Pocket ID or any OIDC-compliant identity provider with group-based access control
- **Release Dashboard** — View, search, and filter all Helm releases across namespaces with real-time status indicators
- **Chart Store Catalog** — Browse, search, and deploy charts from multiple Helm repositories with auto-detection
- **Release Management** — Inspect, edit values, upgrade, rollback, restart, and uninstall releases
- **Cluster Health Monitoring** — Node inventory, control plane status, API latency, and resource utilization metrics
- **Live Event Stream** — Real-time feed of Kubernetes events and Helm operations
- **Namespace Quotas** — Resource quota tracking per namespace
- **Dark Mode** — Full light/dark theme support
- **Mobile Responsive** — Bottom navigation bar, touch-optimized controls, PWA meta tags

## Architecture

Helm Pilot is built with **Next.js 16 App Router** for the frontend and API layer. It connects to Kubernetes clusters via the REST API using OIDC bearer tokens or service account impersonation. Helm release data is parsed directly from Kubernetes Secrets.

---

## Index

### Getting Started

- [Installation](./getting-started/installation.md) — Prerequisites, local install, Docker Compose
- [Configuration](./getting-started/configuration.md) — Complete environment variables reference
- [Quick Start](./getting-started/quick-start.md) — 5-minute guide to first deployment

### Architecture

- [Overview](./architecture/overview.md) — System design, component tree, in-memory modules
- [Routing](./architecture/routing.md) — File-based routes, dynamic params, catch-all patterns
- [API Design](./architecture/api-design.md) — All API endpoints, JWT sessions, error handling

### Authentication

- [OIDC Setup](./authentication/oidc-setup.md) — OIDC flow, openid-client v6, group access control
- [Pocket ID](./authentication/pocket-id.md) — Pocket ID configuration, redirect URIs, TLS, troubleshooting
- [RBAC](./authentication/rbac.md) — Direct OIDC vs impersonation, ClusterRole examples, debugging

### Kubernetes

- [Cluster Connection](./kubernetes/cluster-connection.md) — Connection methods, TLS, test endpoint, cluster selector
- [Helm Releases](./kubernetes/helm-releases.md) — Release lifecycle, parsing, bulk operations, deploy wizard
- [Impersonation](./kubernetes/impersonation.md) — Service account setup, group handling, 403 debugging

### Deployment

- [Docker](./deployment/docker.md) — Dockerfile, development compose, release script
- [Kubernetes Deploy](./deployment/kubernetes-deploy.md) — Production K8s manifests (Deployment, Service, Ingress, ConfigMap)
- [Health Probes](./deployment/health-probes.md) — Probe endpoints, K8s configuration, rewrite rules

### Development

- [Setup](./development/setup.md) — Project structure, npm scripts, ESLint, Prettier, TypeScript, VS Code
- [Code Standards](./development/code-standards.md) — Lint rules, naming conventions, component patterns, import order
