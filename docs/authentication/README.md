# Authentication

Helm Pilot uses **OpenID Connect (OIDC)** for user authentication. All access to the application requires a valid session established through an OIDC Authorization Code flow. Once authenticated, the session is stored as a JWT in an `HttpOnly` cookie and used to authorize Kubernetes API requests — either directly as a bearer token or through service account impersonation.

## How It Fits Together

1. **OIDC** — The identity layer. Helm Pilot delegates authentication to any OIDC-compliant provider (Pocket ID, Keycloak, Okta, Authentik, Dex, etc.).
2. **Session** — A signed JWT stored in an `HttpOnly` cookie (`helm_session`), valid for 24 hours. Built with the `jose` library.
3. **Kubernetes RBAC** — The authenticated identity (email, groups) is wired into K8s API calls, either by passing the OIDC token directly or by using a service account with impersonation headers.

## Index

| Document | Description |
|---|---|
| [oidc-setup.md](./oidc-setup.md) | OIDC authentication flow, required environment variables, openid-client v6 API usage, group-based access control, and session cookie details. |
| [pocket-id.md](./pocket-id.md) | Pocket ID specific setup — registering an OAuth2 client, redirect URI configuration, TLS handling for self-signed certificates, and troubleshooting common issues. |
| [rbac.md](./rbac.md) | Kubernetes RBAC integration — direct OIDC token mode vs service account impersonation mode, ClusterRole and ClusterRoleBinding examples, debugging 403 errors, and verifying impersonation. |

## Quick Reference

### Required Environment Variables

```bash
OIDC_CLIENT_ID=<your-client-id>
OIDC_CLIENT_SECRET=<your-client-secret>
OIDC_ISSUER_URL=https://your-idp.example.com
APP_URL=http://localhost:3000                  # or your deployment URL
```

### With Pocket ID (development)

```bash
OIDC_CLIENT_ID=f9b09bfb-969a-420f-90d6-2efdfec00723
OIDC_CLIENT_SECRET=<pocket-id-client-secret>
OIDC_ISSUER_URL=https://pocketid.lan
OIDC_SKIP_TLS_VERIFY=true
```

### Auth API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/url` | `GET` | Returns the OIDC authorization URL and sets a state cookie. |
| `/api/auth/callback` | `GET` | Handles the OIDC redirect; exchanges code for tokens; sets session cookie. |
| `/api/auth/session` | `GET` | Returns current session info (email, name, `authenticated`). |
| `/api/auth/logout` | `POST` | Clears the session cookie. |

## Further Reading

- See [Getting Started > Configuration](../getting-started/configuration.md) for the full environment variable reference.
- See [Architecture > API Design](../architecture/api-design.md) for detailed API route specifications.
