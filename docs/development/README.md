# Development

This section covers everything needed to set up a local development environment, understand the codebase conventions, and contribute to Helm Pilot.

---

## Contents

| Document | Description |
|---|---|
| [Setup](./setup.md) | Prerequisites, project structure, npm scripts, ESLint, Prettier, TypeScript, and environment variables |
| [Code Standards](./code-standards.md) | Linting rules, formatting conventions, naming patterns, component architecture, API route patterns, and import ordering |
| [Contributing](./contributing.md) | Contribution workflow, branch naming, commit message format, pull request process, and code review checklist |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 6 |
| Runtime | Node.js 22+ (development) / Node.js 24 (production Docker) |
| Styling | Tailwind CSS 4 |
| Linting | ESLint 10 with typescript-eslint |
| Formatting | Prettier 3 |
| Package manager | npm (with lockfile) |

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/lbenicio/helm-pilot.git
cd helm-pilot
npm ci

# Configure environment
cp .env.example .env
# Edit .env with your OIDC provider details

# Start developing
npm run start:dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The server supports hot module replacement — changes to source files are reflected immediately.
