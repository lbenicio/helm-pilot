# File-Based Routing

Helm Pilot uses **Next.js 16 App Router** file-based routing. Every route is defined by the directory structure under `src/app/`.

## Route map

```
src/app/
├── layout.tsx                            → Root layout (wraps all pages)
├── page.tsx                              → / (Dashboard)
├── charts/
│   └── page.tsx                          → /charts
├── events/
│   └── page.tsx                          → /events
├── health/
│   └── page.tsx                          → /health
├── search/
│   └── page.tsx                          → /search?q=
├── release/
│   └── [namespace]/
│       └── [name]/
│           └── page.tsx                  → /release/:namespace/:name
└── api/
    ├── auth/
    │   ├── url/
    │   │   └── route.ts                  → GET  /api/auth/url
    │   ├── callback/
    │   │   └── route.ts                  → GET  /api/auth/callback
    │   ├── session/
    │   │   └── route.ts                  → GET  /api/auth/session
    │   └── logout/
    │       └── route.ts                  → POST /api/auth/logout
    ├── k8s/
    │   └── [...path]/
    │       └── route.ts                  → /api/k8s/* (catch-all)
    ├── repos/
    │   ├── route.ts                      → GET  /api/repos
    │   ├── [name]/
    │   │   └── route.ts                  → DELETE /api/repos/:name
    │   ├── add/
    │   │   └── route.ts                  → POST /api/repos/add
    │   ├── search/
    │   │   └── route.ts                  → GET  /api/repos/search
    │   └── auto-detect/
    │       └── route.ts                  → POST /api/repos/auto-detect
    ├── health/
    │   └── route.ts                      → GET  /api/health
    ├── healthz/
    │   └── route.ts                      → GET  /api/healthz
    ├── live/
    │   └── route.ts                      → GET  /api/live
    └── ready/
        └── route.ts                      → GET  /api/ready
```

## Page routes

### `layout.tsx` — Root layout

The root layout defines the HTML document shell (metadata, favicons, theme color meta tags) and wraps all page content with the `<Providers>` component. It applies the global CSS import and sets `suppressHydrationWarning` for dark-mode class hydration.

### `page.tsx` — Home page (`/`)

The dashboard. Displays a list of Helm releases grouped by namespace. Supports namespace filtering via the `selectedNamespace` state from `AppContext`.

### `charts/page.tsx` — Chart catalog (`/charts`)

The chart repository browser. Lists charts from all registered Helm repositories. Supports search and one-click install via the `InstallChartModal`.

### `events/page.tsx` — Activity log (`/events`)

Displays a live feed of recent events (K8s cluster events and user-initiated operations). Supports polling for fresh events.

### `health/page.tsx` — Cluster health (`/health`)

Shows cluster health metrics: node status, CPU/memory utilization, control-plane component statuses. Data is fetched from `/api/k8s/cluster-health`.

### `search/page.tsx` — Global search (`/search`)

Receives a search query via the `?q=` search param and displays results across releases, charts, and events.

### `release/[namespace]/[name]/page.tsx` — Release detail (`/release/:ns/:name`)

Displays the full detail view for a single Helm release. Shows revision history, current values, manifest, pod status, and provides actions: rollback, restart, uninstall.

## Dynamic route parameters

| Pattern | Example URL | Params |
| --- | --- | --- |
| `[namespace]` | `/release/kube-system/coredns` | `namespace = "kube-system"` |
| `[name]` | `/release/kube-system/coredns` | `name = "coredns"` |
| `[...path]` | `/api/k8s/releases/kube-system/coredns/rollback` | `path = ["releases", "kube-system", "coredns", "rollback"]` |

The `[...path]` catch-all segment in the K8s API route captures an arbitrary number of path segments as a string array. The handler joins them with `/` and dispatches based on string matching against known operation patterns (see [api-design.md](./api-design.md)).

### Accessing dynamic params in Next.js 16 App Router

Next.js 16 uses **async params** — the `params` prop is a `Promise`:

```ts
// release/[namespace]/[name]/page.tsx
export default async function Page({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;
  // ...
}
```

```ts
// api/k8s/[...path]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  // path is e.g. ["releases", "kube-system", "coredns"]
}
```

## Search parameter handling

The `/search` page reads the query string via Next.js `searchParams`:

```
/search?q=nginx → filters results by "nginx"
```

The repo search API (`/api/repos/search`) also accepts `?q=` and `?repo=` query parameters to filter chart results.

## Client-side navigation

The `Header` and `MobileNav` components use Next.js `useRouter` for programmatic navigation (`router.push()`). The `usePathname` hook determines the active route for styling active nav tabs and building the breadcrumb trail.

## Static assets

Static files (favicons, web manifest) are served from the `public/` directory and referenced at the root path (e.g., `/static/favicon/favicon-32x32.png`).
