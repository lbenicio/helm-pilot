# Deployment

This section covers packaging, containerising, and deploying Helm Pilot to production and staging environments. Helm Pilot is built as a **Next.js standalone application** and ships as a Docker image that can run on any container orchestrator — Kubernetes, Docker Compose, Nomad, or a simple VPS.

---

## Contents

| Document | Description |
|---|---|
| [Docker](./docker.md) | Multi-stage Dockerfile, development compose setup, image release workflow, and runtime environment variables |
| [Kubernetes Deployment](./kubernetes-deploy.md) | Production-grade Deployment, Service, Ingress, ConfigMap, Secret, resource limits, and probe configuration |
| [Health Probes](./health-probes.md) | Available health endpoints (`/health`, `/live`, `/ready`), what each checks, rewrite rules, and K8s probe YAML |

---

## Quick Deploy

**Docker Compose (development):**

```bash
docker compose up --build -d
```

**Docker (production build and push):**

```bash
npm run docker:release 0.2.6
```

**Kubernetes (after building and pushing the image):**

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## Build Output

Helm Pilot's `next.config.ts` sets `output: 'standalone'`, which produces a self-contained production build under `.next/standalone/`. The Dockerfile copies only this output (plus `public/` and `.next/static/`) into the runner stage, keeping the production image small — typically under 200 MB uncompressed.
