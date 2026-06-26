# Helm Pilot

[![Dependabot Updates](https://github.com/lbenicio/helm-pilot/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/lbenicio/helm-pilot/actions/workflows/dependabot/dependabot-updates)

A high-performance, enterprise-grade Kubernetes release dashboard and Helm chart management system. Helm Pilot provides a centralized web-based interface for engineering and platform teams to monitor, deploy, upgrade, and audit Helm releases across multiple clusters with robust security and real-time operational visibility.

---

## Key Features

- **Multi-Cluster Orchestration**: Switch contexts seamlessly between configured Kubernetes clusters with instant API latency, context health status, and server readiness tracking.
- **Unified Chart Registry Catalog**: Seamless browsing of public and private Helm repositories (including pre-configured standard repositories like Bitnami, Prometheus Community, Grafana, and HashiCorp) backed by a high-speed in-memory indexing cache.
- **Dynamic Release Management**: Install, upgrade, rollback, and uninstall Helm charts through an intuitive UI that translates complex chart values and structures into visual, user-friendly options.
- **Detailed Lifecycle Inspection**: Deep-dive into active release payloads, custom YAML configurations, revision history tracking, and low-level resource manifests directly from the web panel.
- **Cluster & Resource Analytics**: Interactive visualizations showing CPU, Memory, and storage utilization over time, combined with namespace quota limits and resource pressure indicators.
- **Proactive Security Scanning**: Integrated chart package structure verification and built-in release scanner to enforce security, check for common structural anomalies, and analyze vulnerabilities prior to live cluster installation.
- **Centralized Operational Auditing**: Comprehensive logging engine tracking cluster configurations, repository synchronization, release status updates, and administrative actions with detailed event categorization.
- **Production-Ready Identity & Access Control**: Enterprise OpenID Connect (OIDC) and OAuth2 authentication flow with secure session serialization, state parameter validation, cookie-based session state protection, and a local credential override.

---

## System Architecture

Helm Pilot is designed as a modern, high-performance, full-stack application:

- **Frontend**: A highly responsive Single Page Application (SPA) built using **React 19**, **Vite**, **Tailwind CSS 4** for styling, **Recharts** for performance metrics, and **Motion** for smooth state transitions.
- **Backend**: A robust **Express** Node.js server that handles API proxy routing, manages repository cache indexing, performs Helm release decoding (processing standard gzip-compressed base64 payloads), audits system actions, and handles secure OIDC authentication exchanges.
- **Build Pipeline**: Combines frontend static optimization with an optimized backend build where server-side files are compiled using `esbuild` into a single, highly efficient bundled format to bypass Node.js relative module runtime overhead.

---

## Directory Structure

```
├── .env.example          # Sample environment configurations
├── Dockerfile            # Multi-stage production container build specification
├── package.json          # Node dependency manifest and automated task runner
├── vite.config.ts        # Client asset-bundling and development proxy settings
├── tsconfig.json         # Strict TypeScript compiler definitions
├── assets/               # Static graphics, logos, and UI asset elements
├── src/
│   ├── main.tsx          # Client-side SPA mounting entrypoint
│   ├── App.tsx           # Global routing, core layout, and state provider
│   ├── server.ts         # Full-stack backend web server and API controllers
│   ├── types/            # Application-wide TypeScript type and interface declarations
│   ├── styles/           # Main global styles and Tailwind imports
│   └── components/       # Reusable user interface components
│       ├── Dashboard.tsx            # Release index, filtering, and main table controls
│       ├── RepoCatalog.tsx          # Helm repository browser, search, and additions
│       ├── ReleaseDetails.tsx       # Live status, revision tracking, rollbacks, and manifests
│       ├── ClusterSelector.tsx      # Multi-cluster connectivity and selector interface
│       ├── ClusterHealthWidget.tsx  # Dynamic performance graphs and network latency gauges
│       ├── NamespaceQuotaWidget.tsx # Live limits visualizer and storage status widgets
│       ├── ResourceUsageChart.tsx   # Real-time resource usage analytics
│       ├── InstallChartModal.tsx    # Modal for release deployment and custom value injection
│       ├── AntivirusScanner.tsx     # Chart package and release security verification module
│       ├── ActivityLog.tsx          # Unified operations and audit trail logging UI
│       └── LoginScreen.tsx          # OIDC / credential authentication portal
```

---

## Configuration & Environment Setup

Configure the application by creating a `.env` file at the root of the project using the structure provided below:

```bash
# Application Routing
APP_URL="https://your-domain.com"

# OIDC OAuth2 Authentication Configuration
OIDC_CLIENT_ID="your_client_id_here"
OIDC_CLIENT_SECRET="your_client_secret_here"
OIDC_ISSUER_URL="https://your-oidc-provider.com"
OIDC_SCOPES="openid profile email"

# Set to "true" to skip TLS validation of OIDC provider certificates (for local or dev testing)
OIDC_SKIP_TLS_VERIFY="false"
```

---

## Getting Started

### Prerequisites

- **Node.js** v22.x or later
- **npm** v10.x or later

### Installation

Clone the repository and install the project dependencies:

```bash
npm install
```

### Local Development

Start the development server with real-time asset compilation and hot reloading:

```bash
npm run dev
```

The application will be accessible locally at `http://localhost:3000`.

---

## Production Deployment

### Build Pipeline

To compile the application for production use:

```bash
npm run build
```

The build process executes two steps:
1. Bundles and minifies client-side assets to `dist/` utilizing **Vite**.
2. Compiles and packages the Express backend TypeScript codebase with **esbuild** into a single, standalone CommonJS file at `dist/server.cjs` for streamlined runtime execution.

### Start the Application

Run the compiled full-stack server:

```bash
npm run start
```

---

## Container Deployment

This repository includes a multi-stage `Dockerfile` optimized for minimal footprint and maximum security.

### Build the Image

```bash
docker build -t helm-pilot:latest .
```

### Run the Container

```bash
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name helm-pilot \
  helm-pilot:latest
```

The system will start listening on port `3000`.

---

## Quality & Code Guidelines

- **Strict Type Checking**: Every file must pass the TypeScript compilation rules without exceptions. Verify type safety via:
  ```bash
  npm run lint
  ```
- **Pruned Production Images**: The container build uses `node-prune` to eliminate unnecessary documentation, markdown files, and TypeScript definitions from production `node_modules` for high-performance container spin-ups.
