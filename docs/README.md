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

## Quick Links

| Section | Description |
|---|---|
| [Getting Started](./getting-started/README.md) | Installation, configuration, and quick start guide |
| [Architecture](./architecture/README.md) | System design, routing, and API design |
| [Authentication](./authentication/README.md) | OIDC setup, Pocket ID configuration, RBAC |
| [Kubernetes](./kubernetes/README.md) | Cluster connection, Helm releases, impersonation |
| [Deployment](./deployment/README.md) | Docker, Kubernetes deployment, health probes |
| [Development](./development/README.md) | Local setup, code standards, contributing |
