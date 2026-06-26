# Contributing

Thank you for considering contributing to Helm Pilot. This document outlines the workflow for proposing, implementing, and merging changes.

---

## How to Contribute

1. **Discuss first.** For significant changes, open an issue to discuss the proposal before writing code. This avoids wasted effort on changes that may not align with the project's direction.
2. **Fork the repository.** Create a personal fork on GitHub.
3. **Work on a feature branch.** Isolate your changes from `main`.
4. **Write clear commits.** Follow the commit message format described below.
5. **Run the quality checks.** Ensure linting, formatting, and type checking pass.
6. **Open a pull request.** Target the `main` branch of the upstream repository.
7. **Respond to review feedback.** Address comments and update your branch.

---

## Branch Naming

Use descriptive branch names with a category prefix:

| Prefix | Purpose | Example |
|---|---|---|
| `feat/` | New features | `feat/add-chart-diff-view` |
| `fix/` | Bug fixes | `fix/oidc-token-refresh` |
| `docs/` | Documentation changes | `docs/deployment-guide` |
| `refactor/` | Code restructuring without behaviour changes | `refactor/k8s-client` |
| `chore/` | Maintenance tasks | `chore/update-deps` |
| `test/` | Adding or updating tests | `test/health-probes` |

```bash
git checkout -b feat/my-feature-name
```

---

## Commit Message Format

Follow the **conventional commit** format:

```
<type>(<scope>): <message>
```

| Type | Description |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `refactor` | Code refactoring (no behaviour change) |
| `chore` | Build, CI, or dependency changes |
| `style` | Formatting or style-only changes |
| `test` | Adding or updating tests |
| `perf` | Performance improvements |

**Scope** should be a module, component, or area of the codebase. Examples:

```
feat(helm): add release diff comparison view
fix(oidc): handle expired refresh tokens gracefully
docs(deployment): add Kubernetes Ingress example
refactor(k8s): extract header construction to helper
chore(deps): update typescript to 6.0.3
```

---

## Pull Request Process

### Before Opening a PR

1. **Rebase on `main`.** Ensure your branch is up to date:

   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run quality checks:**

   ```bash
   npm run type:check      # TypeScript type checking
   npm run fmt:lint         # ESLint
   npm run fmt:format       # Prettier
   ```

3. **Verify the build:**

   ```bash
   npm run build:prod
   ```

4. **Test locally.** Start the dev server and manually verify the change works:

   ```bash
   npm run start:dev
   ```

### Writing the PR Description

Include the following sections:

- **Summary** — one or two sentences describing the change.
- **Motivation** — why is this change needed? Link to any related issues.
- **Approach** — how was the change implemented? Mention any design decisions or trade-offs.
- **Screenshots** (if applicable) — before/after screenshots for UI changes.
- **Checklist** — confirm each item:

  ```markdown
  - [ ] Type checking passes (`npm run type:check`)
  - [ ] Linting passes (`npm run fmt:lint`)
  - [ ] Formatting passes (`npm run fmt:format`)
  - [ ] Production build succeeds (`npm run build:prod`)
  - [ ] Manual testing completed
  ```

### During Review

- Respond to all comments, even if only with a 👍 or "Done".
- Push additional commits to the same branch — the PR updates automatically.
- If the review requires significant changes, consider rebasing and force-pushing to keep the history clean.
- Once approved, the maintainer will merge the PR.

---

## Code Review Checklist

Reviewers use this checklist when evaluating pull requests. Submitters should verify these items before requesting review.

| # | Item |
|---|---|
| 1 | Does the change solve the stated problem? |
| 2 | Is the code consistent with existing patterns in the codebase? |
| 3 | Are edge cases handled (empty states, error responses, loading states)? |
| 4 | Are new dependencies justified and at their latest stable version? |
| 5 | Is environment variable usage correct (secrets in `.env`, never committed)? |
| 6 | Are API routes returning appropriate HTTP status codes? |
| 7 | Are client components marked with `'use client'` only when necessary? |
| 8 | Is the `any` type used sparingly and only where appropriate? |
| 9 | Are imports correctly ordered (alphabetical, external before internal)? |
| 10 | Does the change include or update relevant documentation? |

---

## Running Quality Checks

| Check | Command | Description |
|---|---|---|
| Type checking | `npm run type:check` | Runs `tsc --noEmit` to validate TypeScript types |
| Linting | `npm run fmt:lint` | Runs ESLint with auto-fix on all files |
| Formatting | `npm run fmt:format` | Runs Prettier on all source files |
| Production build | `npm run build:prod` | Runs `next build` to verify the app compiles for production |

Run all three before submitting a PR:

```bash
npm run type:check && npm run fmt:lint && npm run fmt:format && npm run build:prod
```

---

## Building for Production

### Local Production Build

```bash
# 1. Build the standalone output
npm run build:prod

# 2. Start the production server
npm run start:prod
```

The production server starts at `http://localhost:3000`. This uses the same standalone output that the Docker image uses.

### Docker Production Build

```bash
# Build the image
docker build -t helm-pilot:local .

# Run it
docker run --rm -p 3000:3000 --env-file .env helm-pilot:local
```

---

## Project Governance

Helm Pilot is maintained by [@lbenicio](https://github.com/lbenicio). All contributions are subject to the project's [Code of Conduct](../../CODE_OF_CONDUCT.md) and [GPL-3.0 license](../../LICENSE.txt).

For questions about contributing, open a GitHub Discussion or contact the maintainers.
