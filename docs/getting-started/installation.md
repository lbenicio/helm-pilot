# Installation

This guide covers every supported method for installing and running Helm Pilot — from a quick local development setup to a containerised deployment with Docker Compose.

---

## Prerequisites

| Requirement | Minimum Version | Notes |
|---|---|---|
| **Node.js** | 22.x or later | Alpine-based images use Node 22; production builds use Node 24 |
| **npm** | 10.x or later | Ships with Node.js 22+ |
| **Git** | 2.x or later | Only needed if cloning the repository |
| **Docker** (optional) | 24.x or later | Required for the Docker Compose workflow |
| **Docker Compose** (optional) | 2.x or later | Required for the Docker Compose workflow |

The runtime has no external database or cache dependencies — all state is kept in-memory and within the Kubernetes API server you connect to.

---

## Local Installation (without Docker)

### 1. Clone the repository

```bash
git clone https://github.com/lbenicio/helm-pilot.git
cd helm-pilot
```

### 2. Install dependencies

Use `npm ci` for a clean, reproducible install based on the lockfile:

```bash
npm ci
```

> **Note:** `npm ci` is preferred over `npm install` because it respects `package-lock.json` exactly and removes existing `node_modules` first. If you need to update dependencies later, use `npm run deps:update` followed by `npm run deps:install`.

### 3. Create the environment file

Copy the example environment file and populate it with your values:

```bash
cp .env.example .env
```

Open `.env` in your editor and fill in the required variables (see the [Configuration](./configuration.md) reference for details on every variable). At a minimum you need:

- `APP_URL` — the URL where Helm Pilot is accessible
- `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` — your OIDC application credentials
- `OIDC_ISSUER_URL` — your identity provider's discovery endpoint

### 4. Start the development server

```bash
npm run start:dev
```

The application will be reachable at **http://localhost:3000**. The dev server supports hot reloading for both the Next.js frontend and API routes.

---

## Docker Compose (Development)

The project includes a `Dockerfile.dev` and `docker-compose.yml` for a containerised development workflow. This is useful when you want to run Helm Pilot in an environment that mirrors production without installing Node.js locally.

### 1. Clone and configure

```bash
git clone https://github.com/lbenicio/helm-pilot.git
cd helm-pilot
cp .env.example .env
# Edit .env with your values
```

### 2. Start the stack

```bash
docker compose up --build -d
```

This builds the `Dockerfile.dev` image (Node 22 Alpine), mounts the project directory as a volume for live reload, and exposes port **3000**.

### 3. View logs

```bash
docker compose logs -f
```

### 4. Stop the stack

```bash
docker compose down
```

---

## Docker Compose (Production)

The production `Dockerfile` uses a multi-stage build to produce a minimal standalone image.

```bash
# Build the image
docker build -t helm-pilot:latest .

# Run the container
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name helm-pilot \
  helm-pilot:latest
```

The image exposes port **3000** and runs `node server.js` from the Next.js standalone output. No development tooling or TypeScript source is included.

> **⚠️ Important:** Change `SESSION_SECRET` to a strong, random value before running in production. The default fallback is insecure and intended for development only.

---

## Health Checks

Helm Pilot exposes several health endpoints that can be used with container orchestrators or load balancers:

| Endpoint | Purpose |
|---|---|
| `/health` | General health check |
| `/healthz` | Kubernetes-style health probe |
| `/live` / `/liveness` | Liveness probe |
| `/ready` / `/readiness` | Readiness probe (indicates the server is ready to accept traffic) |

Example Docker health check:

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/healthz"]
  interval: 30s
  timeout: 10s
  retries: 3
```

---

## Verifying the Installation

After starting the server, open your browser and navigate to `http://localhost:3000`. You should see the Helm Pilot login screen. From there you can authenticate with your OIDC provider and connect to a Kubernetes cluster.

If the page does not load:

1. Check that port 3000 is not in use by another process.
2. Verify the `.env` file exists and contains valid values.
3. Run `npm run type:check` to confirm there are no TypeScript errors.
4. Check the server logs for any startup errors.

---

## Next Steps

- [Configure all environment variables](./configuration.md)
- [Follow the 5-minute Quick Start guide](./quick-start.md)
