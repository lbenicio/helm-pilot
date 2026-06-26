# Architecture

Documentation covering the system architecture, routing design, and internal API surface of Helm Pilot.

## Index

| Document | Description |
| --- | --- |
| [overview.md](./overview.md) | High-level system architecture: runtime model, component tree, library modules, and shared state. |
| [routing.md](./routing.md) | Next.js App Router file-based routing: page routes, dynamic segments, catch-all API pattern. |
| [api-design.md](./api-design.md) | API route design: authentication flow, K8s proxy operations, Helm repo management, health endpoints, session handling, impersonation, and error semantics. |

## What Helm Pilot is

Helm Pilot is a single-process Next.js 16 application that provides a browser-based dashboard for managing Helm releases on a Kubernetes cluster. The frontend React components and backend API routes coexist in the same Node.js runtime, sharing library modules under `src/lib/`. All runtime state (Helm repo registry, OIDC issuer discovery cache, in-memory activity log) is process-local.

For a full walk-through of how these pieces connect, start with [overview.md](./overview.md).
