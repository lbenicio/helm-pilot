# Kubernetes RBAC Integration

Helm Pilot integrates with Kubernetes Role-Based Access Control (RBAC) to enforce per-user permissions on cluster operations. This document covers the two authentication modes, how to configure ClusterRoles and ClusterRoleBindings, and how to debug access issues.

---

## How Helm Pilot Authenticates to Kubernetes

There are **two modes** for authenticating Helm Pilot's Kubernetes API calls. The mode is determined by whether `K8S_TOKEN` is set.

### Mode Comparison

| Aspect | Direct OIDC Token | Service Account Impersonation |
|---|---|---|
| **Trigger** | `K8S_TOKEN` is **not set** | `K8S_TOKEN` is set |
| **Bearer token sent to K8s** | User's OIDC token (`session.token`) | Service account token (`K8S_TOKEN`) |
| **K8s sees the request as** | The OIDC user | The service account, but acting on behalf of (impersonating) the OIDC user |
| **Requires API server OIDC flags** | Yes (`--oidc-issuer-url`, etc.) | No |
| **Per-user RBAC** | K8s validates the OIDC token and applies RBAC directly | K8s applies RBAC to the impersonated user/group |
| **Recommended for** | Clusters already configured with OIDC authentication | Production deployments; clusters without native OIDC integration |

---

## Mode 1: Direct OIDC Token

In this mode, Helm Pilot passes the user's OIDC token directly as the `Authorization: Bearer` header to the Kubernetes API server.

### How It Works

1. After OIDC login, the user's `id_token` (or `access_token`) is stored in the session.
2. Each K8s API call includes this token as the bearer token.
3. The Kubernetes API server validates the token against the configured OIDC issuer.
4. Kubernetes applies RBAC based on the user and group claims in the token.

### Kubernetes API Server Configuration

The Kubernetes API server must be started with OIDC flags:

```
kube-apiserver \
  --oidc-issuer-url=https://your-idp.example.com \
  --oidc-client-id=<your-client-id> \
  --oidc-username-claim=email \
  --oidc-groups-claim=groups \
  --oidc-ca-file=/etc/kubernetes/pki/oidc-ca.crt
```

| Flag | Description |
|---|---|
| `--oidc-issuer-url` | The OIDC provider's issuer URL. Must match `OIDC_ISSUER_URL` in Helm Pilot's config. |
| `--oidc-client-id` | The client ID that the token was issued to. |
| `--oidc-username-claim` | The JWT claim to use as the username. Helm Pilot uses `email`. |
| `--oidc-groups-claim` | The JWT claim to use as the groups. Helm Pilot uses `groups`. |
| `--oidc-ca-file` | CA certificate for verifying the IdP's TLS certificate. |

> **Note:** If the API server is not configured with OIDC flags, it will reject OIDC tokens with a `401 Unauthorized` error. Use the impersonation mode instead (Mode 2) if you cannot modify the API server configuration.

---

## Mode 2: Service Account Impersonation

In this mode, Helm Pilot uses a **Kubernetes service account token** to authenticate to the API server and **impersonates** the OIDC-authenticated user via HTTP headers.

### How It Works

1. A Kubernetes service account is created with `impersonate` permissions.
2. The service account token is provided to Helm Pilot via the `K8S_TOKEN` environment variable.
3. When making K8s API calls, Helm Pilot adds two headers:
   - `Impersonate-User: <user's email>`
   - `Impersonate-Group: <user's first group>`
4. The Kubernetes API server processes the request as if the impersonated user made it, applying RBAC to that user/group.

> **Current limitation:** Due to how Node.js `fetch` merges same-name headers, only the **first** group from the user's `session.groups` array is sent. Full multi-group impersonation would require a different HTTP client or proxy layer.

### Configuration

```bash
# .env
K8S_API_URL="https://k8s-api.example.com:6443"
K8S_TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6..."
```

### Creating the Impersonator Service Account

Create a service account, ClusterRole, and ClusterRoleBinding that grants impersonation permissions:

```yaml
# helm-pilot-impersonator.yaml
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: helm-pilot-impersonator
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: helm-pilot-impersonator
rules:
  - apiGroups: [""]
    resources: ["users", "groups", "serviceaccounts"]
    verbs: ["impersonate"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: helm-pilot-impersonator
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: helm-pilot-impersonator
subjects:
  - kind: ServiceAccount
    name: helm-pilot-impersonator
    namespace: default
```

Apply it:

```bash
kubectl apply -f helm-pilot-impersonator.yaml
```

### Retrieving the Service Account Token

```bash
# Create a long-lived token secret (Kubernetes 1.24+)
kubectl create token helm-pilot-impersonator -n default --duration=87600h
```

Copy the token and set it as `K8S_TOKEN` in your `.env` file.

---

## ClusterRole Examples

Below are ClusterRoles that grant specific permissions to Helm Pilot users. Bind them to OIDC users or groups as needed.

### Events Reader (Read-Only)

Allows viewing Kubernetes events and listing releases/namespaces. Suitable for auditors and viewers.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: helm-pilot-events-reader
rules:
  # Read events
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["get", "list", "watch"]
  # Read pods, deployments, services
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets", "daemonsets", "replicasets"]
    verbs: ["get", "list", "watch"]
  # Read Helm Secrets
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list", "watch"]
    resourceNames: []
  # Read namespaces
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list"]
  # Read resource quotas
  - apiGroups: [""]
    resources: ["resourcequotas"]
    verbs: ["get", "list"]
```

> **Note:** The Secrets rule above allows reading Helm release Secrets by name. You may want to further restrict this with `resourceNames` or label selectors if your cluster uses a different mechanism.

### Nodes Reader (Read-Only)

Allows viewing node and component statuses (cluster health dashboard).

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: helm-pilot-nodes-reader
rules:
  - apiGroups: [""]
    resources: ["nodes", "componentstatuses"]
    verbs: ["get", "list", "watch"]
```

### Helm Operator (Read-Write)

Allows full Helm release lifecycle management: install, upgrade, rollback, restart, uninstall.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: helm-pilot-operator
rules:
  # Read access
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps", "events", "namespaces", "resourcequotas"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets", "daemonsets", "replicasets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["nodes", "componentstatuses"]
    verbs: ["get", "list", "watch"]
  # Helm Secrets
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  # Restart workloads
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets", "daemonsets"]
    verbs: ["patch"]
```

---

## ClusterRoleBinding Examples

### Binding to a Specific OIDC User (by Email)

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: helm-pilot-operator-jane
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: helm-pilot-operator
subjects:
  - kind: User
    name: "jane.operator@example.com"   # Must match the email claim from OIDC
    apiGroup: rbac.authorization.k8s.io
```

### Binding to an OIDC Group

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: helm-pilot-admin-group
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: helm-pilot-operator
subjects:
  - kind: Group
    name: "admin"                        # Must match the groups claim from OIDC
    apiGroup: rbac.authorization.k8s.io
```

> **Important:** When using impersonation mode, the `User` and `Group` names in the binding must match the values in the `Impersonate-User` and `Impersonate-Group` headers (i.e., the user's email and first group from the session).
>
> When using direct OIDC token mode, the names must match the claims in the OIDC token as interpreted by the API server (determined by `--oidc-username-claim` and `--oidc-groups-claim`).

### Binding Multiple Roles to One Group

```yaml
# Grant the "platform-eng" group events-reader and operator access
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: helm-pilot-events-platform-eng
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: helm-pilot-events-reader
subjects:
  - kind: Group
    name: "platform-eng"
    apiGroup: rbac.authorization.k8s.io
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: helm-pilot-operator-platform-eng
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: helm-pilot-operator
subjects:
  - kind: Group
    name: "platform-eng"
    apiGroup: rbac.authorization.k8s.io
```

---

## Debugging Access Issues

### Check OIDC Claims

Set `LOG_LEVEL=debug` in your `.env` file to see the claims Helm Pilot extracts after login:

```bash
LOG_LEVEL="debug"
```

After logging in, check the server logs:

```
[DEBUG] [OIDC] Login: { email: 'jane@example.com', name: 'Jane Operator', groups: ['admin', 'platform-eng'] }
```

This confirms the email and groups that will be used for K8s authorization.

### Verify Impersonation with kubectl

To test whether impersonation works, impersonate the user manually using the service account token:

```bash
# Export the service account token
export SA_TOKEN="eyJhbGciOiJSUzI1NiIs..."

# Impersonate the user and check permissions
kubectl auth can-i list secrets \
  --as="jane@example.com" \
  --as-group="admin" \
  --token="$SA_TOKEN"
```

If this returns `yes`, impersonation of that user/group is properly configured.

You can also test specific Helm Pilot operations:

```bash
# Can the user list Helm releases (read Secrets)?
kubectl auth can-i list secrets -n kube-system \
  --as="jane@example.com" \
  --as-group="admin" \
  --token="$SA_TOKEN"

# Can the user create Secrets (install/upgrade releases)?
kubectl auth can-i create secrets -n default \
  --as="jane@example.com" \
  --as-group="admin" \
  --token="$SA_TOKEN"

# Can the user delete Secrets (uninstall releases)?
kubectl auth can-i delete secrets -n default \
  --as="jane@example.com" \
  --as-group="admin" \
  --token="$SA_TOKEN"

# Can the user patch Deployments (restart releases)?
kubectl auth can-i patch deployments -n default \
  --as="jane@example.com" \
  --as-group="admin" \
  --token="$SA_TOKEN"
```

### Common 403 Errors

#### "Kubernetes API error 403: secrets is forbidden"

**Cause:** The user (or impersonated user) does not have `get`/`list`/`create`/`delete` permissions on Secrets in the target namespace.

**Solution:**
1. Verify the ClusterRole includes the necessary verbs on `secrets`.
2. Verify the ClusterRoleBinding is correctly bound to the user's email or group.
3. Check that the user's email/group in the binding matches exactly what the OIDC provider returns.
4. In impersonation mode, check that the group sent via `Impersonate-Group` matches the group in the binding.

#### "Kubernetes API error 403: impersonation not allowed"

**Cause:** The service account used for impersonation does not have `impersonate` permissions.

**Solution:** Apply the impersonator ClusterRole and ClusterRoleBinding as shown in the [Creating the Impersonator Service Account](#creating-the-impersonator-service-account) section above.

#### "Kubernetes API error 403: User cannot impersonate"

**Cause:** The service account has `impersonate` permissions on `users` but not on `groups`, or the `Impersonate-Group` header is being sent but the SA lacks `impersonate` on the `groups` resource.

**Solution:** Ensure the ClusterRole includes both:

```yaml
- apiGroups: [""]
  resources: ["users", "groups", "serviceaccounts"]
  verbs: ["impersonate"]
```

#### "Kubernetes API error 401: Unauthorized"

**Cause (Direct mode):** The OIDC token is invalid, expired, or the API server does not recognize the issuer.

**Solutions:**
1. Check that the API server's `--oidc-issuer-url` matches `OIDC_ISSUER_URL`.
2. Verify the token is not expired (OIDC tokens typically expire within 1 hour).
3. Confirm the API server's `--oidc-client-id` matches `OIDC_CLIENT_ID`.
4. Check the API server logs for token validation errors.

**Cause (Impersonation mode):** The service account token (`K8S_TOKEN`) is invalid or expired.

**Solutions:**
1. Verify the token is correctly set in `.env`.
2. Generate a new token if it has expired.
3. Check that the service account exists and is not deleted.

---

## RBAC Troubleshooting Checklist

- [ ] Is the correct mode active? Check if `K8S_TOKEN` is set.
- [ ] Does the user have a valid session? Call `GET /api/auth/session`.
- [ ] Are the user's email and groups correct? Check `LOG_LEVEL=debug` output.
- [ ] Does the ClusterRole grant the necessary verbs on the correct resources?
- [ ] Does the ClusterRoleBinding bind to the correct `User` (email) or `Group`?
- [ ] In impersonation mode, does the service account have `impersonate` permissions?
- [ ] In impersonation mode, is only one group being sent? (Node.js `fetch` limitation — only the first group in the array is sent.)
- [ ] For direct OIDC mode, is the API server configured with `--oidc-*` flags?
- [ ] Are there any network policies or webhook authorizers blocking the requests?
