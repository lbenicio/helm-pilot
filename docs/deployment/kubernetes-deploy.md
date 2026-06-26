# Kubernetes Deployment

This document provides production-grade Kubernetes manifests for deploying Helm Pilot. All resources assume the `helm-pilot` namespace and the `lbenicio/helm-pilot` Docker image.

---

## Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: helm-pilot
```

---

## Secret

Store sensitive values (OIDC client secret, K8s service account token) in a Kubernetes Secret. Never commit secrets to version control.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: helm-pilot-secrets
  namespace: helm-pilot
type: Opaque
stringData:
  # OIDC client secret from your identity provider
  OIDC_CLIENT_SECRET: "your-client-secret-here"

  # Service account token for K8s impersonation (optional)
  K8S_TOKEN: "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
```

> **Note:** Use `stringData` for convenience during development. In production, prefer pre-encoded `data` fields or a tool like Sealed Secrets or External Secrets Operator.

---

## ConfigMap

Non-sensitive configuration lives in a ConfigMap. Update it independently of the Deployment; a rollout restart is required for changes to take effect.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: helm-pilot-config
  namespace: helm-pilot
data:
  APP_URL: "https://helm.example.com"
  OIDC_CLIENT_ID: "helm-pilot"
  OIDC_ISSUER_URL: "https://sso.example.com/realms/production"
  OIDC_SCOPES: "openid profile email groups"
  OIDC_ALLOWED_GROUPS: "platform-team,admin"
  OIDC_SKIP_TLS_VERIFY: "false"
  K8S_API_URL: "https://k8s-api.example.com:6443"
  K8S_CLUSTER_NAME: "prod-us-east"
```

---

## Deployment

The Deployment runs a single replica by default. Scale horizontally behind a load balancer if needed — the application is stateless except for the OIDC session cookie (which is self-contained and signed, requiring no shared session store).

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: helm-pilot
  namespace: helm-pilot
  labels:
    app: helm-pilot
spec:
  replicas: 1
  selector:
    matchLabels:
      app: helm-pilot
  template:
    metadata:
      labels:
        app: helm-pilot
    spec:
      containers:
        - name: helm-pilot
          image: lbenicio/helm-pilot:0.2.5
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP

          envFrom:
            - configMapRef:
                name: helm-pilot-config
            - secretRef:
                name: helm-pilot-secrets

          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "3000"

          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi

          livenessProbe:
            httpGet:
              path: /live
              port: http
            initialDelaySeconds: 10
            periodSeconds: 15
            timeoutSeconds: 3
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 2
            failureThreshold: 3

          startupProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 0
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 12

          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            runAsUser: 1000
            capabilities:
              drop:
                - ALL
```

### Resource Recommendations

| Environment | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---|---|---|---|---|
| Development / staging | 100m | 250m | 128Mi | 256Mi |
| Low-traffic production | 100m | 500m | 256Mi | 512Mi |
| High-traffic production | 250m | 1 | 512Mi | 1Gi |

> **Tip:** Monitor actual usage with `kubectl top pod -n helm-pilot` and adjust limits accordingly. The Next.js server is single-threaded per process; for higher throughput, increase replicas rather than CPU limits.

---

## Service

### ClusterIP (internal)

Use a ClusterIP Service when an Ingress controller handles external traffic.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: helm-pilot
  namespace: helm-pilot
  labels:
    app: helm-pilot
spec:
  type: ClusterIP
  selector:
    app: helm-pilot
  ports:
    - name: http
      port: 80
      targetPort: http
      protocol: TCP
```

### LoadBalancer (direct exposure)

Use a LoadBalancer Service only in cloud environments where you need a public IP directly — for example, when not using an Ingress controller.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: helm-pilot-lb
  namespace: helm-pilot
  labels:
    app: helm-pilot
spec:
  type: LoadBalancer
  selector:
    app: helm-pilot
  ports:
    - name: http
      port: 80
      targetPort: http
      protocol: TCP
```

---

## Ingress

The Ingress resource exposes Helm Pilot via a hostname and handles TLS termination. The example assumes an NGINX Ingress Controller and a TLS secret managed by cert-manager.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: helm-pilot
  namespace: helm-pilot
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - helm.example.com
      secretName: helm-pilot-tls
  rules:
    - host: helm.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: helm-pilot
                port:
                  name: http
```

> **Important:** Helm Pilot's OIDC callback path is `/api/auth/callback`. The Ingress must route this path correctly, or authentication will fail. The `Prefix` path type above handles all sub-paths.

---

## Probes in Detail

Helm Pilot exposes multiple health-check endpoints at the application level. The `next.config.ts` rewrites map top-level paths to their `/api/*` counterparts:

| External path | Internal handler | Use case |
|---|---|---|
| `/health` | `/api/health` | Startup probe — simple liveness, returns HTTP 200 with uptime |
| `/healthz` | `/api/healthz` | Alternative liveness — returns HTTP 200 with timestamp |
| `/live` | `/api/live` | Liveness probe — always returns HTTP 200 if the process is running |
| `/liveness` | `/api/live` | Alias for `/live` |
| `/ready` | `/api/ready` | Readiness probe — always returns HTTP 200 if the process is running |
| `/readiness` | `/api/ready` | Alias for `/ready` |

See [Health Probes](./health-probes.md) for the full reference including expected response codes, timing, and what each endpoint checks.

### Probe Configuration Rationale

- **startupProbe** uses `/health` with a generous `failureThreshold: 12` (up to 60 seconds) because the Next.js server can take several seconds to compile and start on first request in production mode.
- **livenessProbe** uses `/live` with a `failureThreshold: 3` and `periodSeconds: 15` — if the process is alive, restarting is unlikely to help; a crash would cause the container to exit anyway.
- **readinessProbe** uses `/ready` with `periodSeconds: 10` — shorter interval to react quickly when a pod becomes unhealthy but before it's killed.

---

## Bringing It All Together

```bash
# 1. Create the namespace
kubectl apply -f namespace.yaml

# 2. Apply secrets and config (replace placeholder values first)
kubectl apply -f secret.yaml
kubectl apply -f configmap.yaml

# 3. Deploy the application
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml

# 4. Verify
kubectl -n helm-pilot get pods
kubectl -n helm-pilot get ingress
curl -s https://helm.example.com/health | jq
```
