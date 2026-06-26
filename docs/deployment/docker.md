# Docker

Helm Pilot provides two Dockerfiles: a **multi-stage production build** based on Node 24 Alpine, and a **development build** based on Node 22 Alpine with hot-reload support.

---

## Production Dockerfile (`Dockerfile`)

The production image uses a multi-stage build to keep the final image lean. Only the Next.js standalone output is copied into the runner stage — no source code, no `node_modules`, no build tooling.

```dockerfile
# Build stage
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:prod

# Production stage
FROM node:24-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Next.js standalone output contains only the needed files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# Next.js standalone creates server.js as entry point
CMD ["node", "server.js"]
```

### Build the production image

```bash
docker build -t helm-pilot:latest .
```

### Run the production image

```bash
docker run --rm -p 3000:3000 --env-file .env helm-pilot:latest
```

---

## Development Dockerfile (`Dockerfile.dev`)

The development image mounts the source tree and `node_modules` as volumes so that file changes on the host are immediately reflected inside the container. The `start:dev` script runs `next dev` with hot module replacement.

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
```

---

## Docker Compose (`docker-compose.yml`)

The compose file uses `Dockerfile.dev` and mounts the project root as a volume. Anonymous volumes for `node_modules` and `.next` prevent the host's directories from shadowing the container's installed dependencies and build cache.

```yaml
services:
  helm-pilot:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - '3000:3000'
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    environment:
      - NODE_ENV=development
    env_file:
      - .env
    restart: unless-stopped
```

### Compose commands

| Command | Description |
|---|---|
| `npm run docker:up` / `docker compose up --build -d` | Build and start the dev container in detached mode |
| `npm run docker:down` / `docker compose down` | Stop and remove the container |
| `npm run docker:logs` / `docker compose logs -f` | Follow container logs |

---

## Release Script (`scripts/docker.sh`)

The release script builds a multi-arch image and pushes it to **Docker Hub** and **GitHub Container Registry (GHCR)**. It tags the image with both the version number and `latest`.

```bash
#!/bin/sh
set -e

VERSION="${1}"
if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.2.4"
  exit 1
fi

IMAGE_DH="lbenicio/helm-pilot"
IMAGE_GH="ghcr.io/lbenicio/helm-pilot"

echo "Building helm-pilot:${VERSION}..."
docker build --platform linux/amd64 \
  -t "${IMAGE_DH}:latest" \
  -t "${IMAGE_DH}:${VERSION}" \
  -t "${IMAGE_GH}:latest" \
  -t "${IMAGE_GH}:${VERSION}" .

echo "Pushing to Docker Hub..."
docker push "${IMAGE_DH}:latest"
docker push "${IMAGE_DH}:${VERSION}"

echo "Pushing to GitHub Container Registry..."
docker push "${IMAGE_GH}:latest"
docker push "${IMAGE_GH}:${VERSION}"
```

### Run the release

```bash
npm run docker:release 0.2.6
```

This is equivalent to running `sh scripts/docker.sh 0.2.6`.

> **Note:** You must be logged in to both registries before running the release script:
> ```bash
> docker login
> docker login ghcr.io -u <your-github-username>
> ```

---

## Runtime Environment Variables

All environment variables are read at container start-up. Pass them via `--env-file` (Docker run), the `env_file` directive (Compose), or a Kubernetes ConfigMap/Secret.

| Variable | Required | Description |
|---|---|---|
| `APP_URL` | Yes | Public-facing URL of the application (e.g. `https://helm.example.com`). Used for OIDC redirect URI construction. |
| `OIDC_CLIENT_ID` | Yes | OIDC client ID registered with the identity provider |
| `OIDC_CLIENT_SECRET` | Yes | OIDC client secret |
| `OIDC_ISSUER_URL` | Yes | OIDC provider issuer URL (e.g. `https://sso.example.com`) |
| `OIDC_SCOPES` | No | Space-separated OIDC scopes. Default: `openid profile email` |
| `OIDC_ALLOWED_GROUPS` | No | Comma-separated list of OIDC groups allowed to log in. If unset, all authenticated users are permitted. |
| `OIDC_SKIP_TLS_VERIFY` | No | Set to `true` to disable TLS certificate verification for OIDC provider and K8s API calls. **Only use in development or air-gapped environments.** |
| `K8S_API_URL` | No | Default Kubernetes API server URL. If set, the cluster appears automatically after login. |
| `K8S_CLUSTER_NAME` | No | Human-readable name for the default cluster. Defaults to `"Default Cluster"`. |
| `K8S_TOKEN` | No | Service account bearer token for impersonation mode. If set, the server authenticates to K8s with this token and impersonates OIDC users. If unset, the user's OIDC access token is passed directly to the K8s API. |
| `PORT` | No | Port the server listens on. Default: `3000`. |
| `NODE_ENV` | No | Set to `production` by the Dockerfile runner stage. |

### Example `.env` for production

```bash
APP_URL="https://helm.example.com"
OIDC_CLIENT_ID="helm-pilot"
OIDC_CLIENT_SECRET="s3cret-k3y"
OIDC_ISSUER_URL="https://sso.example.com/realms/production"
OIDC_SCOPES="openid profile email groups"
OIDC_ALLOWED_GROUPS="platform-team,admin"
K8S_API_URL="https://k8s-api.example.com:6443"
K8S_CLUSTER_NAME="prod-us-east"
```
