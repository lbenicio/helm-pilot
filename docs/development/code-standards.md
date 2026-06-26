# Code Standards

This document describes the coding conventions enforced in the Helm Pilot codebase. Most rules are automated via ESLint and Prettier; conventions that cannot be automated are documented here.

---

## ESLint Rules

### `@typescript-eslint/no-explicit-any` — disabled

Using `any` is permitted. Many Kubernetes API responses have complex, dynamically-shaped payloads where typing would add more ceremony than value. Use `any` judiciously — prefer `unknown` when the shape is truly unknown, and `any` only when the type is understood but impractical to model.

```typescript
// Acceptable — K8s API responses are dynamic
const result: any = await callK8sApi(config, path);

// Prefer unknown when the shape is genuinely unknown
function parse(input: unknown): ParsedData { /* ... */ }
```

### `@typescript-eslint/no-unused-vars` — warn with `_` prefix patterns

Unused variables trigger a warning. Variables, arguments, and caught errors prefixed with `_` are ignored:

```typescript
// Warning: 'data' is declared but never used
const data = await fetchSomething();

// OK: underscore prefix signals intentional non-use
const _data = await fetchSomething();

// OK: unused callback argument
items.map((_item, index) => <Row key={index} />);

// OK: unused caught error
try { /* ... */ } catch (_err) { /* ignore */ }
```

---

## Perfectionist Plugin

The `eslint-plugin-perfectionist` enforces consistent ordering of imports and exports. All rules are set to `warn`:

### `perfectionist/sort-imports`

Imports must be ordered alphabetically by source module path:

```typescript
// ❌ Incorrect — unordered imports
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { callK8sApi } from '@/lib/k8s';
import type { NextRequest } from 'next/server';

// ✅ Correct — alphabetical by module path
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { callK8sApi } from '@/lib/k8s';
```

### `perfectionist/sort-exports`

Named exports must be ordered alphabetically:

```typescript
// ✅ Correct
export { Dashboard } from './Dashboard';
export { Header } from './Header';
export { Providers } from './Providers';
```

### `perfectionist/sort-named-imports`

Named imports from the same module must be ordered alphabetically:

```typescript
// ❌ Incorrect
import { Suspense, useState, useEffect } from 'react';

// ✅ Correct
import { Suspense, useEffect, useState } from 'react';
```

Run `npm run fmt:lint` to auto-fix ordering issues.

---

## Prettier Formatting

All formatting is handled by Prettier with the following configuration (`.prettierrc`):

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 140,
  "tabWidth": 2
}
```

| Rule | Value | Example |
|---|---|---|
| Semicolons | Always | `const x = 1;` |
| Quotes | Single quotes | `import { foo } from './bar';` |
| Trailing commas | All (ES5+) | `{ a: 1, b: 2, }` |
| Line width | 140 characters | Wider than default to reduce line breaks in JSX |
| Indentation | 2 spaces | `  const x = 1;` |

Run `npm run fmt:format` to format all source files.

---

## File Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Source files | `kebab-case.ts` | `cluster-connection.ts`, `release-details.tsx` |
| React components | `PascalCase.tsx` | `Dashboard.tsx`, `ClusterSelector.tsx` |
| API route handlers | `route.ts` (Next.js convention) | `src/app/api/health/route.ts` |
| Layout files | `layout.tsx` (Next.js convention) | `src/app/layout.tsx` |
| Page files | `page.tsx` (Next.js convention) | `src/app/page.tsx` |
| Library modules | `kebab-case.ts` | `src/lib/k8s.ts`, `src/lib/oidc.ts` |
| Configuration files | `kebab-case.ext` | `eslint.config.mjs`, `next.config.ts` |

---

## Component Patterns

### Server Components (default)

In the Next.js App Router, components are **server components by default**. They render on the server and send HTML to the client. Server components cannot use hooks (`useState`, `useEffect`), browser APIs, or event handlers.

```typescript
// src/app/page.tsx — server component (no 'use client' directive)
import { Dashboard } from '@/components/Dashboard';

export default function HomePage() {
  return (
    <main>
      <Dashboard />
    </main>
  );
}
```

### Client Components

Components that need interactivity, state, effects, or browser APIs must include the `'use client'` directive at the top of the file:

```typescript
'use client';

import { useState } from 'react';

export function ClusterSelector() {
  const [open, setOpen] = useState(false);
  // ...
}
```

### Guidelines

1. **Keep client components as leaf nodes.** Push interactivity down to the smallest possible component. The parent layout and page components should remain server components whenever possible.
2. **Pass data as props.** Fetch data in server components and pass it down to client components as props. Avoid fetching inside client components unless the data is user-specific and fetched after hydration.
3. **Wrap client providers at the layout level.** Context providers (`AppContext`, `SessionProvider`) are client components and should be placed in `layout.tsx` or a dedicated `Providers.tsx` wrapper.
4. **Use `Suspense` boundaries.** Wrap data-fetching components in `<Suspense>` to enable streaming SSR and avoid blocking the entire page on slow data.

---

## API Route Patterns

API routes follow the Next.js App Router convention: a directory with a `route.ts` file that exports named HTTP method handlers.

### Structure

```typescript
// src/app/api/<resource>/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Read query params, headers, cookies
  const { searchParams } = new URL(request.url);

  // Business logic
  const data = await fetchData();

  // Return JSON
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // ...
  return NextResponse.json({ success: true }, { status: 201 });
}
```

### Conventions

1. **Use `NextResponse.json()`** for all API responses. This sets the correct `Content-Type` header and handles serialisation.
2. **Type the request.** Always type the `request` parameter as `NextRequest`.
3. **Handle errors explicitly.** Catch exceptions and return appropriate status codes:

```typescript
try {
  const data = await riskyOperation();
  return NextResponse.json(data);
} catch (error) {
  return NextResponse.json(
    { error: 'Operation failed', detail: String(error) },
    { status: 500 },
  );
}
```

4. **Read environment variables server-side only.** API routes run on the server, so `process.env` is available. Never expose secrets in client responses.
5. **Keep route handlers thin.** Extract business logic to `src/lib/` modules. Route handlers should be coordination layers — reading input, delegating to libraries, and returning responses.

---

## Import Order

Import ordering is enforced by Prettier and the `perfectionist` ESLint plugin. The effective order after formatting is:

1. **Side-effect imports** (e.g. `import './globals.css'`)
2. **External packages** (alphabetical by package name)
3. **Internal aliased imports** (`@/lib/*`, `@/components/*`)
4. **Relative imports** (`./`, `../`)
5. **Type imports** (`import type { ... }`)

```typescript
// Example of correctly ordered imports

// 1. Side-effect imports
import './globals.css';

// 2. External packages (alphabetical)
import { motion } from 'motion';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Suspense } from 'react';

// 3. Internal aliased imports
import { Dashboard } from '@/components/Dashboard';
import { callK8sApi } from '@/lib/k8s';

// 4. Type imports
import type { NextRequest } from 'next/server';
import type { K8sCluster } from '@/types';
```

Run `npm run fmt:format && npm run fmt:lint` to automatically sort imports in the correct order.
