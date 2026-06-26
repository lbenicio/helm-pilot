# Pocket ID Setup

[Pocket ID](https://github.com/pocket-id/pocket-id) is a lightweight, self-hosted OIDC provider designed for homelab and small-team environments. It is the recommended identity provider for Helm Pilot development and internal deployments.

This guide covers registering an OAuth2 client in Pocket ID, configuring Helm Pilot to connect to it, handling TLS for self-signed certificates, and troubleshooting common issues.

---

## Prerequisites

- Pocket ID running and accessible (default: `https://pocketid.lan`)
- Admin access to the Pocket ID admin panel (typically at `https://pocketid.lan/admin`)

---

## Registering an OAuth2 Client in Pocket ID

1. **Log in** to the Pocket ID admin panel.
2. Navigate to **OAuth2 Clients** (or **Applications**, depending on your Pocket ID version).
3. Click **Create OAuth2 Client**.
4. Fill in the details:

   | Field | Value |
   |---|---|
   | **Name** | `Helm Pilot` (or any descriptive name) |
   | **Redirect URI** | `http://localhost:3000/api/auth/callback` |
   | **Scopes** | `openid`, `profile`, `email`, `groups` |
   | **Grant Types** | Authorization Code |

5. Click **Save**. Pocket ID will generate a **Client ID** and **Client Secret**.
6. Copy both values — you will need them in your `.env` file.

> **Important:** The redirect URI must match exactly what Helm Pilot uses (<code><var>APP_URL</var>/api/auth/callback</code>). If `APP_URL` is `https://helm-pilot.lan`, the redirect URI must be `https://helm-pilot.lan/api/auth/callback`. Trailing slashes in `APP_URL` are stripped automatically.

---

## Redirect URI Configuration

Helm Pilot constructs the callback URL as:

```
APP_URL/api/auth/callback
```

| `APP_URL` | Resulting Redirect URI |
|---|---|
| `http://localhost:3000` | `http://localhost:3000/api/auth/callback` |
| `https://helm-pilot.example.com` | `https://helm-pilot.example.com/api/auth/callback` |
| `http://192.168.1.100:3000` | `http://192.168.1.100:3000/api/auth/callback` |

The `APP_URL` must be reachable by the browser **after** the user authenticates at Pocket ID. In local development, `http://localhost:3000` works because both Helm Pilot and the browser run on the same machine. If you access Helm Pilot from another machine on your network, you must use the machine's IP or hostname.

> **Note:** Pocket ID requires that the redirect URI registered in the OAuth2 client exactly matches the one sent in the authorization request. Even a trailing slash difference will cause a `redirect_uri mismatch` error.

---

## Environment Configuration

### Minimal `.env` for Pocket ID

```bash
# Application
APP_URL="http://localhost:3000"

# OIDC (Pocket ID)
OIDC_CLIENT_ID="f9b09bfb-969a-420f-90d6-2efdfec00723"
OIDC_CLIENT_SECRET="<your-client-secret>"
OIDC_ISSUER_URL="https://pocketid.lan"
```

### Full Development `.env` with Groups and TLS Bypass

```bash
# Application
APP_URL="http://localhost:3000"
LOG_LEVEL="debug"

# OIDC (Pocket ID)
OIDC_CLIENT_ID="f9b09bfb-969a-420f-90d6-2efdfec00723"
OIDC_CLIENT_SECRET="<your-client-secret>"
OIDC_ISSUER_URL="https://pocketid.lan"
OIDC_SCOPES="openid profile email groups"
OIDC_ALLOWED_GROUPS="admin"
OIDC_SKIP_TLS_VERIFY="true"
```

---

## TLS Certificate Handling

Pocket ID typically uses **self-signed certificates** (especially in homelab environments). The default TLS certificate is not trusted by Node.js's certificate store, which causes connections from Helm Pilot to Pocket ID to fail.

### Development: Skip TLS Verification

Set `OIDC_SKIP_TLS_VERIFY=true` in your `.env` file:

```bash
OIDC_SKIP_TLS_VERIFY="true"
```

This sets `NODE_TLS_REJECT_UNAUTHORIZED=0` globally, bypassing TLS verification for **both** the OIDC provider and the Kubernetes API server.

> **⚠️ Security Warning:** This disables certificate validation entirely. Never use this in production. It is acceptable for development, homelab environments, or sandboxes where the network is trusted.

### Production: Use Valid Certificates

In production, you should:

1. Obtain a valid certificate for your Pocket ID instance (e.g., via Let's Encrypt, or by adding your internal CA certificate to the Node.js trust store).
2. Set `OIDC_SKIP_TLS_VERIFY=false` (or omit it).
3. If using an internal CA, set `NODE_EXTRA_CA_CERTS` to point to your CA bundle:

   ```bash
   NODE_EXTRA_CA_CERTS="/etc/ssl/certs/my-ca-bundle.crt"
   ```

---

## Group-Based Access Control with Pocket ID

Pocket ID supports group claims, which Helm Pilot uses for RBAC. To enable group-based access:

1. **Request the `groups` scope** in Helm Pilot:

   ```bash
   OIDC_SCOPES="openid profile email groups"
   ```

2. **Create groups** in Pocket ID (in the admin panel under Users & Groups).
3. **Assign users to groups** in Pocket ID.
4. **Restrict access** in Helm Pilot:

   ```bash
   OIDC_ALLOWED_GROUPS="admin,platform-eng"
   ```

When a user logs in, Helm Pilot checks that at least one of their Pocket ID groups matches the `OIDC_ALLOWED_GROUPS` list. If not, they receive a `403 Access denied: unauthorized groups` error.

---

## Troubleshooting

### "redirect_uri mismatch" error

**Symptoms:** After logging in at Pocket ID, you see an error page mentioning "redirect_uri mismatch" or the redirect fails silently.

**Cause:** The redirect URI registered in the Pocket ID OAuth2 client does not match the one Helm Pilot constructs (`APP_URL/api/auth/callback`).

**Solutions:**

1. Verify the `APP_URL` environment variable: it should start with `http://` or `https://` and not have a trailing slash.

   ```bash
   # Check what Helm Pilot is using
   grep APP_URL .env
   ```

2. Check what redirect URI Helm Pilot is constructing by setting `LOG_LEVEL=debug` and watching the server logs:

   ```
   [DEBUG] [OIDC] Auth URL: { redirectUri: 'http://localhost:3000/api/auth/callback', clientId: '...' }
   ```

3. Update the Pocket ID OAuth2 client's redirect URI to match **exactly** (including protocol, host, port, and path).

4. Restart Helm Pilot after changing `APP_URL`.

### Certificate errors (UNABLE_TO_VERIFY_LEAF_SIGNATURE / self-signed certificate)

**Symptoms:** Login fails, and the server logs show:

```
[ERROR] OIDC token exchange failed: fetch failed
```
or
```
[ERROR] OIDC token exchange failed: self-signed certificate
```

**Cause:** Node.js cannot verify Pocket ID's TLS certificate because it is self-signed or uses an internal CA.

**Solutions:**

1. **Quick fix (development):** Set `OIDC_SKIP_TLS_VERIFY=true`.
2. **Proper fix:** Import Pocket ID's CA certificate into the system trust store or use `NODE_EXTRA_CA_CERTS`:

   ```bash
   # Export Pocket ID's CA certificate
   openssl s_client -connect pocketid.lan:443 -showcerts </dev/null 2>/dev/null | \
     openssl x509 -outform PEM > pocketid-ca.pem

   # Point Node.js to it
   export NODE_EXTRA_CA_CERTS="$(pwd)/pocketid-ca.pem"
   ```

3. Verify connectivity independently:

   ```bash
   curl -k https://pocketid.lan/.well-known/openid-configuration
   ```

### "Client not found" or "Invalid client" error

**Symptoms:** The authorization URL redirect fails with "Client not found" or "Invalid client_id".

**Cause:** The `OIDC_CLIENT_ID` does not match any OAuth2 client registered in Pocket ID, or the client was deleted/disabled.

**Solution:** Verify the client ID in your `.env` file matches the one shown in the Pocket ID admin panel. Copy/paste is safest — the IDs are UUIDs and easy to mistype.

### "Access denied: unauthorized groups" (403)

**Symptoms:** Login succeeds but the callback returns `403 Access denied: unauthorized groups`.

**Cause:** The user's Pocket ID groups do not match any entry in `OIDC_ALLOWED_GROUPS`, or the `groups` scope is not requested.

**Solutions:**

1. Verify `OIDC_SCOPES` includes `groups`:

   ```bash
   OIDC_SCOPES="openid profile email groups"
   ```

2. Check what groups the user actually has by setting `LOG_LEVEL=debug` and inspecting the login log:

   ```
   [DEBUG] [OIDC] Login: { email: 'user@example.com', name: 'User', groups: ['viewers'] }
   ```

3. Update `OIDC_ALLOWED_GROUPS` to include one of the user's groups (matching is case-insensitive).

4. In Pocket ID admin, verify the user is assigned to the expected groups.

### General debugging

Set `LOG_LEVEL=debug` to get detailed information about the OIDC flow:

```bash
LOG_LEVEL="debug"
```

This will log:
- The redirect URI being used
- The client ID
- The user's claims after token exchange
- Any errors during the flow

Check the Helm Pilot container or process logs:

```bash
# Docker
docker compose logs -f

# Direct
npm run start:dev
```
