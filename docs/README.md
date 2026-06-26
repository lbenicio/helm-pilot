# Helm Pilot Documentation

Helm Pilot is a web-based Helm Chart and Kubernetes Release Manager with OIDC authentication.

## Index

- [Getting Started](./getting-started/README.md) — Installation, configuration, quick start
- [Architecture](./architecture/README.md) — System design, routing, API design
- [Authentication](./authentication/README.md) — OIDC setup, Pocket ID, RBAC
- [Kubernetes](./kubernetes/README.md) — Cluster connection, Helm releases, impersonation
- [Deployment](./deployment/README.md) — Docker, K8s manifests, health probes
- [Development](./development/README.md) — Local setup, code standards, tooling

---

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
