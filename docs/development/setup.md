# Development Setup

This guide walks through setting up a local Helm Pilot development environment from scratch.

---

## Prerequisites

| Tool | Minimum Version | Check |
|---|---|---|
| Node.js | 22+ | `node --version` |
| npm | 10+ (bundled with Node) | `npm --version` |
| Git | 2.30+ | `git --version` |

Docker is optional for local development. It is only required if you want to build the production image or run the Docker Compose development stack.

---

## Project Structure

```
helm-pilot/
├── .github/                  # GitHub Actions workflows and templates
├── docs/                     # Documentation (what you're reading)
├── public/                   # Static assets (favicon, robots.txt, PWA manifest)
├── scripts/                  # Build and utility scripts
│   ├── changelog.mjs         # Auto-generates CHANGELOG.md
│   └── docker.sh             # Multi-registry Docker build and push
├── src/
│   ├── app/                  # Next.js App Router pages and API routes
│   │   ├── api/              # API route handlers
│   │   │   ├── auth/         # OIDC authentication (login URL, callback)
│   │   │   ├── health/       # Health check endpoint (/api/health)
│   │   │   ├── healthz/      # Alternative health check (/api/healthz)
│   │   │   ├── k8s/          # Kubernetes API proxy endpoints
│   │   │   ├── live/         # Liveness probe (/api/live)
│   │   │   ├── ready/        # Readiness probe (/api/ready)
│   │   │   └── repos/        # Helm repository search
│   │   ├── charts/           # Chart Store page
│   │   ├── events/           # Live events page
│   │   ├── health/           # Cluster health page
│   │   ├── release/          # Release details page
│   │   ├── search/           # Global search page
│   │   ├── layout.tsx        # Root layout (providers, shell)
│   │   └── page.tsx          # Dashboard homepage
│   ├── components/           # React components (PascalCase)
│   ├── contexts/             # React context providers
│   ├── lib/                  # Shared utilities and business logic
│   │   ├── helm.ts           # Helm release parsing and operations
│   │   ├── k8s.ts            # Kubernetes API client
│   │   ├── logger.ts         # Structured logging
│   │   ├── oidc.ts           # OIDC client configuration
│   │   ├── repos.ts          # Helm repository management
│   │   └── session.ts        # Session cookie handling
│   ├── styles/               # Global CSS
│   └── types/                # Shared TypeScript type definitions
├── .dockerignore             # Files excluded from Docker build context
├── .env.example              # Environment variable template
├── .prettierrc               # Prettier configuration
├── Dockerfile                # Multi-stage production build
├── Dockerfile.dev            # Development build with hot-reload
├── docker-compose.yml        # Development compose stack
├── eslint.config.mjs         # ESLint flat configuration
├── next.config.ts            # Next.js configuration (standalone output, rewrites)
├── package.json              # Dependencies and npm scripts
├── postcss.config.mjs        # PostCSS configuration (Tailwind CSS)
├── tsconfig.json             # TypeScript configuration
└── CHANGELOG.md              # Auto-generated changelog
```

---

## NPM Scripts Reference

| Script | Command | Description |
|---|---|---|
| `start:dev` | `next dev --port 3000` | Start the development server with HMR |
| `start:prod` | `next start --port 3000` | Start the production server (requires `build:prod` first) |
| `build:prod` | `next build` | Build the Next.js standalone production output |
| `type:check` | `tsc --noEmit` | Run TypeScript type checking without emitting files |
| `fmt:lint` | `eslint . --fix` | Run ESLint with auto-fix across the project |
| `fmt:format` | `prettier --write "src/**/*.{ts,tsx,css}"` | Format source files with Prettier |
| `docker:release` | `sh scripts/docker.sh` | Build and push the Docker image to Docker Hub and GHCR |
| `docker:up` | `docker compose up --build -d` | Start the Docker Compose development stack |
| `docker:down` | `docker compose down` | Stop and remove the Docker Compose stack |
| `docker:logs` | `docker compose logs -f` | Follow container logs from Compose |
| `deps:update` | `npm-check-updates -u && npm run deps:install` | Update all dependencies to latest versions |
| `deps:install` | `npm install --no-fund --no-audit --verbose` | Install dependencies from updated `package.json` |
| `gen:changelog` | `node scripts/changelog.mjs --bump` | Generate CHANGELOG.md from git history |

---

## ESLint Configuration

Helm Pilot uses the **ESLint flat config** format (`eslint.config.mjs`). The configuration:

1. Ignores `.next`, `dist`, and `node_modules`.
2. Extends `typescript-eslint` recommended rules.
3. Applies the `eslint-plugin-perfectionist` plugin for import/export ordering.

```javascript
import perfectionist from 'eslint-plugin-perfectionist';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next', 'dist', 'node_modules'] },
  {
    extends: [tseslint.configs.recommended],
    plugins: { perfectionist },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'perfectionist/sort-imports': 'warn',
      'perfectionist/sort-exports': 'warn',
      'perfectionist/sort-named-imports': 'warn',
    },
  },
);
```

### Lint commands

```bash
npm run fmt:lint          # Lint and auto-fix all files
npx eslint src/app/api    # Lint a specific directory
```

---

## Prettier Configuration

Prettier is configured via `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 140,
  "tabWidth": 2
}
```

### Format commands

```bash
npm run fmt:format        # Format all source files
npx prettier --check .    # Check formatting without writing
```

---

## TypeScript Configuration

The TypeScript configuration (`tsconfig.json`) targets **ES2024** with the `bundler` module resolution strategy, which is required by Next.js 16.

Key options:

| Option | Value | Rationale |
|---|---|---|
| `target` | `ES2024` | Modern JavaScript output; Node 22+ supports all ES2024 features |
| `module` | `ESNext` | ESM modules throughout |
| `moduleResolution` | `bundler` | Required by Next.js 16 for proper resolution of package exports |
| `jsx` | `react-jsx` | Automatic JSX runtime (no need to import React) |
| `strict` | `false` | Strict mode is off to reduce friction during rapid development |
| `noEmit` | `true` | TypeScript is used only for type checking; Next.js handles compilation |
| `paths` | `@/*` → `./src/*` | Import aliases — e.g. `import { foo } from '@/lib/bar'` |
| `allowImportingTsExtensions` | `true` | Allows `.ts` / `.tsx` extensions in import paths |

### Type check command

```bash
npm run type:check
```

This runs `tsc --noEmit` across the entire project. It does **not** emit compiled files — it only reports type errors.

---

## Environment Setup

### 1. Create the `.env` file

```bash
cp .env.example .env
```

### 2. Configure OIDC

At minimum, set these four variables:

```bash
APP_URL="http://localhost:3000"
OIDC_CLIENT_ID="your-client-id"
OIDC_CLIENT_SECRET="your-client-secret"
OIDC_ISSUER_URL="https://your-oidc-provider.com"
```

### 3. (Optional) Pre-configure a Kubernetes cluster

Add these lines to skip the UI cluster selector:

```bash
K8S_API_URL="https://your-k8s-api.example.com:6443"
K8S_CLUSTER_NAME="staging"
```

### 4. Start the dev server

```bash
npm run start:dev
```

The server starts at [http://localhost:3000](http://localhost:3000). Any changes to source files trigger hot module replacement.

### 5. Verify

```bash
curl -s http://localhost:3000/health | jq
```

Expected output:

```json
{
  "status": "OK",
  "uptime": 12.345,
  "timestamp": "2026-06-26T..."
}
```

---

## Editor Integration

### VS Code Recommended Extensions

- **ESLint** (`dbaeumer.vscode-eslint`) — inline linting feedback
- **Prettier** (`esbenp.prettier-vscode`) — format on save
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`) — class autocompletion

### Format on Save (VS Code `settings.json`)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```
