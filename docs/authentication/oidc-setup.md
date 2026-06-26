# OIDC Authentication Setup

Helm Pilot authenticates users via the **OpenID Connect Authorization Code flow**. This document covers how the flow works, what environment variables control it, how the session is managed, and how the `openid-client` v6 library is used under the hood.

---

## How the OIDC Flow Works

```
┌──────────┐      ┌──────────────┐      ┌──────────┐      ┌───────────────┐
│  Browser │      │  Helm Pilot  │      │   IdP    │      │  K8s API      │
│  (React) │      │  (Next.js)   │      │  (OIDC)  │      │  Server       │
└────┬─────┘      └──────┬───────┘      └────┬─────┘      └──────┬────────┘
     │                    │                  │                   │
     │ 1. GET /api/auth/url                 │                   │
     │───────────────────▶│                  │                   │
     │                    │ 2. oidc.discovery()                  │
     │                    │─────────────────▶│                   │
     │                    │ ◀─────────────────│                   │
     │                    │ 3. buildAuthorizationUrl()           │
     │ 4. { url, type }   │                  │                   │
     │ ◀───────────────────│                  │                   │
     │                    │                  │                   │
     │ 5. window.location = url             │                   │
     │──────────────────────────────────────▶│                   │
     │                    │                  │                   │
     │ 6. User authenticates at IdP         │                   │
     │                    │                  │                   │
     │ 7. Redirect ?code=...&state=...      │                   │
     │ ◀────────────────────────────────────│                   │
     │                    │                  │                   │
     │ 8. GET /api/auth/callback?code=...   │                   │
     │───────────────────▶│                  │                   │
     │                    │ 9. authorizationCodeGrant()          │
     │                    │─────────────────▶│                   │
     │                    │ ◀──── tokenSet ───│                   │
     │                    │                  │                   │
     │                    │ 10. (optional) fetchUserInfo()       │
     │                    │─────────────────▶│                   │
     │                    │                  │                   │
     │                    │ 11. Check OIDC_ALLOWED_GROUPS       │
     │                    │                  │                   │
     │                    │ 12. Create JWT → helm_session cookie │
     │ 13. Set-Cookie + redirect to /        │                   │
     │ ◀───────────────────│                  │                   │
     │                    │                  │                   │
     │ 14. Subsequent API calls read helm_session                │
     │──────────────────────────────────────────────────────────▶│
```

### Step-by-step

1. **User visits Helm Pilot.** The frontend detects no session (via `GET /api/auth/session`) and shows the login page.
2. **Login button triggers `GET /api/auth/url`.** The server performs OIDC discovery against the issuer URL to obtain the provider's endpoints, then constructs the authorization URL with the configured scopes.
3. **A random `state` is generated** (via `openid-client`'s `randomState()`) and stored in an `HttpOnly` cookie (`oidc_state`, 10-minute TTL) for CSRF protection.
4. **The authorization URL is returned** to the frontend, which redirects the browser to the identity provider.
5. **User authenticates at the IdP** (username/password, MFA, etc.).
6. **IdP redirects back** to `APP_URL/api/auth/callback` with `code` and `state` query parameters.
7. **`GET /api/auth/callback` handler:**
   - Retrieves the `oidc_state` cookie and validates it against the `state` query parameter.
   - Performs the Authorization Code Grant — exchanges the `code` for tokens (ID token, access token, optional refresh token).
   - Extracts claims: `email`, `name` (falls back to `preferred_username` → `given_name`), and `groups`.
   - If name/email are not present in the ID token claims, falls back to the `userinfo_endpoint`.
   - Checks group authorization if `OIDC_ALLOWED_GROUPS` is configured.
   - Creates a JWT session payload and sets the `helm_session` cookie.
   - Clears the `oidc_state` cookie.
   - Redirects the browser to `/`.
8. **All subsequent requests** include the `helm_session` cookie. The server decodes the JWT on each request to retrieve the user's email, name, token, and groups.

---

## Required Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OIDC_CLIENT_ID` | **Yes** | The OAuth2 client ID registered with your OIDC provider. |
| `OIDC_CLIENT_SECRET` | **Yes** | The OAuth2 client secret registered with your OIDC provider. Used in the token exchange. |
| `OIDC_ISSUER_URL` | **Yes** | The issuer URL of your OIDC provider. Must match the `iss` claim in tokens. Used for OIDC discovery (`/.well-known/openid-configuration`). |
| `APP_URL` | **Yes**¹ | The full URL where Helm Pilot is accessible (e.g., `https://helm-pilot.example.com`). Used to construct the redirect URI (`APP_URL/api/auth/callback`). Defaults to `http://localhost:3000` if unset. |

¹ `APP_URL` defaults to `http://localhost:3000`, so it is not strictly required for local development. It **must** be set in production or when the app is accessed on a non-localhost address, otherwise the redirect URI will not match the one registered with the IdP.

---

## Optional Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OIDC_SCOPES` | `openid profile email` | Space-separated list of scopes to request from the IdP. The `openid` scope is automatically prepended if missing (required by the OIDC specification). Add `groups` to enable group-based access control. |
| `OIDC_SKIP_TLS_VERIFY` | `false` | Set to `true` to bypass TLS certificate validation for both the OIDC provider and the Kubernetes API server. Sets `NODE_TLS_REJECT_UNAUTHORIZED=0` globally. **Only for development with self-signed certificates.** |
| `OIDC_ALLOWED_GROUPS` | _(none)_ | Comma-separated list of OIDC groups permitted to access Helm Pilot. When set, a user must belong to at least one of the listed groups. Matching is **case-insensitive**. If unset, all authenticated users are granted access. |
| `SESSION_SECRET` | _(hardcoded dev key)_ | The secret used to sign and verify JWT session cookies (HS256). A static fallback is used if unset. **Must be changed to a strong random value in production.** Generate with: `openssl rand -hex 32`. |

---

## Session Management

### Cookie Details

| Attribute | Value |
|---|---|
| Name | `helm_session` |
| Type | JWT (HS256) |
| Library | [`jose`](https://github.com/panva/jose) v6 |
| Signing secret | `process.env.SESSION_SECRET` (falls back to a hardcoded dev key) |
| Expiry | 24 hours (`maxAge: 86400`) |
| `HttpOnly` | `true` |
| `Secure` | `true` in production (`NODE_ENV === "production"`) |
| `SameSite` | `lax` |
| `Path` | `/` |

### Session Payload Structure

```ts
interface SessionUser {
  email: string;       // User's email address
  name: string;        // Display name
  token?: string;      // OIDC id_token (preferred) or access_token
  groups?: string[];   // OIDC groups claim (if 'groups' scope is requested)
}
```

The `token` field contains either the `id_token` or the `access_token` from the token set. This token is used as the bearer token for Kubernetes API calls **unless** `K8S_TOKEN` is configured (which enables impersonation mode — see [rbac.md](./rbac.md)).

### Session Lifecycle

- **Created** on successful OIDC callback (`GET /api/auth/callback`).
- **Read** by the `getSession()` utility on every authenticated request.
- **Cleared** by `POST /api/auth/logout` (sets the cookie to an empty value with `maxAge: 0`).
- **Expires** after 24 hours regardless of activity. There is no sliding expiration or refresh mechanism.

---

## OIDC State Cookie

A separate short-lived cookie protects the Authorization Code flow against CSRF:

| Attribute | Value |
|---|---|
| Name | `oidc_state` |
| Type | Random opaque string (via `openid-client`'s `randomState()`) |
| Expiry | 10 minutes (`maxAge: 600`) |
| `HttpOnly` | `true` |
| `Secure` | `true` in production |
| `SameSite` | `lax` |

The state is set by `GET /api/auth/url` and validated by `GET /api/auth/callback`. After a successful callback, the cookie is cleared.

---

## openid-client v6 API Usage

Helm Pilot uses [`openid-client`](https://github.com/panva/openid-client) v6, a certified OpenID Connect relying party library. All OIDC logic lives in `src/lib/oidc.ts`.

### Discovery

```ts
import * as oidc from 'openid-client';

// Performed once, then cached in memory for the process lifetime.
const config = await oidc.discovery(
  new URL(process.env.OIDC_ISSUER_URL!),
  process.env.OIDC_CLIENT_ID!,
  process.env.OIDC_CLIENT_SECRET,
);
```

The discovery call fetches `/.well-known/openid-configuration` from the issuer URL and returns a `Configuration` object containing the authorization, token, userinfo, and JWKS endpoints. This configuration is cached in memory after the first call (process-level, not persisted).

### Building the Authorization URL

```ts
import { randomState, buildAuthorizationUrl } from 'openid-client';

const state = randomState();
const authUrl = buildAuthorizationUrl(config, {
  redirect_uri: `${appUrl}/api/auth/callback`,
  scope: 'openid profile email groups',
  state,
});
```

### Authorization Code Grant (Callback)

```ts
import { authorizationCodeGrant } from 'openid-client';

const callbackUrl = new URL(`${redirectUri}?code=...&state=...`);
const tokenSet = await authorizationCodeGrant(config, callbackUrl, {
  expectedState, // validated against the state stored in the oidc_state cookie
});

// Extract claims
const claims = tokenSet.claims();
// claims.email, claims.name, claims.groups, etc.
```

### Fetching UserInfo

If the ID token does not contain sufficient claims (e.g., the provider returns minimal ID tokens), the server falls back to the `userinfo_endpoint`:

```ts
import { fetchUserInfo } from 'openid-client';

const userInfo = await fetchUserInfo(config, accessToken, undefined);
// userInfo.email, userInfo.name, userInfo.preferred_username, etc.
```

---

## Group-Based Access Control

Helm Pilot can restrict access to specific OIDC groups using the `OIDC_ALLOWED_GROUPS` environment variable.

### Configuration

```bash
# Allow only users in the "admin" or "platform-eng" groups
OIDC_ALLOWED_GROUPS="admin,platform-eng"
```

Leave it unset (or empty) to allow **any** authenticated user.

### How It Works

1. The `groups` scope must be requested for group claims to be returned. Add it to `OIDC_SCOPES`:

   ```bash
   OIDC_SCOPES="openid profile email groups"
   ```

2. After the token exchange, the callback handler extracts the `groups` claim from the token set.
3. If `OIDC_ALLOWED_GROUPS` is configured, the handler checks if **any** of the user's groups match **any** of the allowed groups (case-insensitive comparison).
4. If no match is found, the user receives a `403 Access denied: unauthorized groups` response.

### Important Notes

- Group matching is **case-insensitive**. `Admin` matches `admin`.
- The user needs **at least one** matching group. Membership in multiple groups is fine.
- If the IdP does not return group claims (or returns them under a different claim name), you may need to configure your IdP to include them in the ID token or userinfo response.
- Set `LOG_LEVEL=debug` to see the user's groups in the server logs:

  ```
  [DEBUG] [OIDC] Login: { email: 'user@example.com', name: 'User', groups: ['admin', 'developers'] }
  ```

---

## Common Issues

### "OIDC not configured" (500)

**Cause:** `OIDC_CLIENT_ID` or `OIDC_CLIENT_SECRET` is not set.

**Solution:** Verify both variables are present in your `.env` file and that the server was restarted after changes.

### "OIDC Callback failed: invalid_grant" (401)

**Cause:** The authorization code has expired or been used already, or the `state` cookie does not match.

**Solution:** Restart the login flow. If it persists, check that your IdP's clock is synchronized and that `APP_URL` matches the redirect URI registered with the IdP.

### Session cookie not being sent

**Cause:** `Secure` flag is `true` but the connection is not HTTPS (in production mode).

**Solution:** In development, ensure `NODE_ENV` is not set to `production`, or access the app over HTTPS.

### UserInfo endpoint errors

Helm Pilot only calls the `userinfo_endpoint` as a fallback when name/email are not available in the ID token. If the userinfo call fails, a warning is logged but the login still succeeds with fallback values. Check your IdP's configuration if the user's name/email appears as `Administrator` / `admin@example.com`.
