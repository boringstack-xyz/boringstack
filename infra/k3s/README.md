# infra/k3s: Kubernetes / GitOps deployment target

A portable, opinionated way to ship BoringStack to any ArgoCD-managed
k3s/Kubernetes cluster. This is the cluster alternative to the single-host
[`infra/compose`](../compose) and [`infra/bootstrap`](../bootstrap) targets.
Pick the one that fits; you don't need all three.

Push code, CI builds and pushes GHCR images, argocd-image-updater bumps the tag,
and ArgoCD syncs. The full app (api, ui, Postgres, Valkey, GlitchTip) runs in one
namespace with HA, autoscaling, and TLS.

> This target is Compose-first BoringStack's opt-in cluster path. It is kept in
> its own `infra/k3s/` subtree precisely so it never blurs the simpler Compose
> deployment flow.

## Layout

```
infra/k3s/
├── argocd/        ArgoCD Application (+ image-updater) and registration example
├── base/          env-agnostic manifests: namespace, api, ui, valkey, postgres
└── overlays/prod/ HA + TLS + secrets + GlitchTip + monitoring + patches
    └── secrets/   swappable secrets backend: vault (default) | sealed | plain
```

## Cluster prerequisites

The target cluster must provide these (all common, operator-installable):

| Need | Used for |
|------|----------|
| ArgoCD + argocd-image-updater | GitOps sync and auto image bumps |
| CloudNativePG operator | the Postgres `Cluster` |
| cert-manager + a DNS-01 `ClusterIssuer` | TLS certs |
| Traefik (k3s default) with `web`/`websecure` entrypoints | ingress |
| a default/persistent StorageClass | Postgres and Valkey volumes |
| (optional) kube-prometheus-stack | the ServiceMonitor and Grafana dashboards |
| a secrets backend | Vault+VSO (default), or the SealedSecrets controller |

## The knobs to edit (per fork)

1. Rebrand. `scripts/rename-project.sh <project> <ghcr-owner> <domain>` from the
   repo root rewrites every `boringstack` / `boringstack-api` / `boringstack-ui`
   / `boringstack-xyz` token across the repo, including these manifests.
2. Domain. Replace `boringstack.example.com` (and
   `glitchtip.boringstack.example.com`) in `overlays/prod/ingress.yaml`,
   `certificate.yaml`, and `glitchtip/`.
3. ClusterIssuer. Set `issuerRef.name` in `overlays/prod/certificate.yaml` to
   your cluster's DNS-01 issuer (`kubectl get clusterissuer`).
4. StorageClass. Uncomment/set `storageClass` in `base/postgres/cluster.yaml` and
   `base/valkey/statefulset.yaml` if you don't want the cluster default.
5. Repo URL. Set `source.repoURL` in `argocd/boringstack-prod.yaml` to your fork,
   and add it to ArgoCD as a repo credential.
6. Image tag strategy. `argocd/boringstack-prod.yaml` assumes CI tags images with
   the git SHA. If your CI uses semver, switch the `update-strategy` /
   `allow-tags` annotations.

## Secrets

Workloads only ever read two k8s Secrets, `boringstack-secrets` (app env) and
`ghcr-registry-secret` (GHCR pull), plus the CNPG-generated `boringstack-db-app`
(`DATABASE_URL`). How those get populated is the swappable component in
`overlays/prod/secrets/`:

- `vault` (default). Vault + Vault Secrets Operator. Seed KV-v2 paths
  `secret/boringstack`, `secret/boringstack-registry` (and `secret/boringstack-backup`
  for backups), and bind a Vault role `boringstack-prod-role` to the
  `boringstack-prod/default` ServiceAccount.
- `sealed`. Bitnami SealedSecrets (commit encrypted manifests). See its README.
- `plain`. Kustomize `secretGenerator` over a gitignored `secret.env`. See its README.

Swap by editing the one active line under `# Secrets backend (pick ONE)` in
`overlays/prod/kustomization.yaml`.

### App secret keys (`boringstack-secrets`)

The authoritative key list is the api's env validator, documented on the
[Environment variables](https://boringstack.xyz/reference/env-vars/) reference.
Populate from there rather than copying a list that drifts. The k3s-specific
points:

- `DATABASE_URL` is injected by CloudNativePG, so it is NOT a key here.
- `VALKEY_PASSWORD` is shared: the api, GlitchTip, and the Valkey StatefulSet's
  `--requirepass` all read it.
- The GlitchTip overlay needs `GLITCHTIP_SECRET_KEY` plus `GLITCHTIP_SUPERUSER_EMAIL`
  / `GLITCHTIP_SUPERUSER_PASSWORD` (and optional `GLITCHTIP_EMAIL_URL`).
- Enough to boot: `JWT_SECRET`, `MFA_ENCRYPTION_KEY`, `VALKEY_PASSWORD`,
  `FRONTEND_URL`, `PUBLIC_API_URL`, `QUEUES_ENABLED=true`, `CACHE_PROVIDER=valkey`.
  Email, OAuth, Stripe, Web Push, and AI keys follow the reference.

## Deploy

1. Rebrand and edit the knobs above.
2. Ensure CI builds and pushes `ghcr.io/<owner>/<project>-api` and `-ui`. The UI
   build must pass the `VITE_*` build args (`VITE_API_URL` empty for same-origin,
   `VITE_SENTRY_DSN` set to your GlitchTip DSN). This is the same image pipeline
   the Compose/WUD path uses.
3. Populate secrets via your chosen backend.
4. Register with ArgoCD, either:
   - `kubectl apply -f infra/k3s/argocd/boringstack-prod.yaml`, or
   - add `argocd/app-of-apps-registration.example.yaml` to your app-of-apps repo.
5. ArgoCD runs the PreSync migration Job (`db:migrate && db:seed`), then rolls
   out the deployments. Watch it reach Healthy.

## Verify

```bash
# Structural render (no cluster needed)
kubectl kustomize infra/k3s/overlays/prod | head

# Live
kubectl -n boringstack-prod get pods
curl -sI https://<domain>/health        # 200 from the api
curl -sI https://<domain>/              # 200 from the ui (SPA)
```

## What's intentionally not here

- In-cluster Prometheus/Grafana/Loki. Integrate with the cluster's stack
  (`overlays/prod/monitoring/`).
- Provisioning the cluster itself. Bring your own k3s.
- App code. That's `apps/api` and `apps/ui`.
