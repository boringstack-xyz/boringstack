# infra/k3s: Kubernetes / GitOps deployment target

A portable, opinionated way to ship BoringStack to any ArgoCD-managed
k3s/Kubernetes cluster. This is the cluster alternative to the single-host
[`infra/compose`](../compose) and [`infra/bootstrap`](../bootstrap) targets.
Pick the one that fits; you don't need all three.

Push code. The production release workflow builds the API, migrations and UI
images for that commit, then pins all three digests in one commit. ArgoCD syncs
that set. The full app (api, ui, Postgres, Valkey, GlitchTip) runs in one
namespace with HA, autoscaling, and TLS.

> This target is Compose-first BoringStack's opt-in cluster path. It is kept in
> its own `infra/k3s/` subtree precisely so it never blurs the simpler Compose
> deployment flow.

## Layout

```
infra/k3s/
├── argocd/        ArgoCD Application and registration example
├── base/          env-agnostic manifests: namespace, api, ui, valkey, postgres
├── overlays/prod/ HA + TLS + secrets + GlitchTip + monitoring + patches
│   └── secrets/   swappable secrets backend: vault (default) | sealed | plain
└── tests/         release invariants, run against the real prod render
```

## Cluster prerequisites

The target cluster must provide these (all common, operator-installable):

| Need | Used for |
|------|----------|
| ArgoCD | GitOps sync and wave-ordered rollout |
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
   the DNS-01 issuer for your zone (`kubectl get clusterissuer`). See
   [the issuer pitfall](#clusterissuer-pitfall) below.
4. StorageClass. Uncomment/set `storageClass` in `base/postgres/cluster.yaml` and
   `base/valkey/statefulset.yaml` if you don't want the cluster default.
5. Repo URL. Set `source.repoURL` in `argocd/boringstack-prod.yaml` to your fork,
   and add it to ArgoCD as a repo credential.
6. Public UI settings. `VITE_PUBLIC_URL`, `VITE_SENTRY_DSN` and
   `VITE_VAPID_PUBLIC_KEY` are GitHub repository variables read by
   `.github/workflows/production-release.yml`. No domain is hard-coded there.

### ClusterIssuer pitfall

A `ClusterIssuer` carries one DNS-01 credential, usually scoped to one zone. If
the Certificate's `dnsNames` include a zone that credential cannot write, the
`_acme-challenge` TXT record is never created. The Certificate then stays
`Ready=False` forever, and Traefik keeps serving its self-signed default
certificate. Cloudflare tokens are per account, so two zones in two accounts
need two issuers. Pick the issuer whose token covers every `dnsName`, and check
with `kubectl describe certificate` and the challenge events before the first
sync.

## Secrets

Workloads only ever read two k8s Secrets, `boringstack-secrets` (app env) and
`ghcr-registry-secret` (GHCR pull), plus the CNPG-generated `boringstack-db-app`
(`DATABASE_URL`) and `boringstack-db-ca` (the CNPG CA, `ca.crt`). How those get
populated is the swappable component in `overlays/prod/secrets/`:

- `vault` (default). Vault + Vault Secrets Operator. Seed KV-v2 paths
  `secret/boringstack`, `secret/boringstack-registry` (and `secret/boringstack-backup`
  for backups), and bind a Vault role `boringstack-prod-role` to the
  `boringstack-prod/default` ServiceAccount. The VSO secrets set `excludeRaw`, so
  the `_raw` Vault response is not added as one JSON env var.
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
- `DATABASE_SSL_CA` is injected from `boringstack-db-ca`, so it is not a key here
  either. The API and the migration Job verify the database certificate against
  it. Leave `DATABASE_SSL_REJECT_UNAUTHORIZED` at its default (`true`).
- `VALKEY_PASSWORD` is shared: the api, GlitchTip, and the Valkey StatefulSet's
  `--requirepass` all read it.
- The GlitchTip overlay needs `GLITCHTIP_SECRET_KEY` plus `GLITCHTIP_SUPERUSER_EMAIL`
  / `GLITCHTIP_SUPERUSER_PASSWORD` (and optional `GLITCHTIP_EMAIL_URL`).
- Enough to boot: `JWT_SECRET`, `MFA_ENCRYPTION_KEY`, `VALKEY_PASSWORD`,
  `FRONTEND_URL`, `PUBLIC_API_URL`, `QUEUES_ENABLED=true`, `CACHE_PROVIDER=valkey`.
  Email, OAuth, Stripe, Web Push, and AI keys follow the reference.

## Images and the coordinated release

`.github/workflows/production-release.yml` is the only publisher of images for
this target. On every push to `main` that touches the app or this target, it:

1. Waits, up to 45 minutes, for every applicable push workflow at the same
   commit to succeed. Missing, cancelled, failed and timed-out checks block the
   release. A newer `main` commit supersedes an older one.
2. Builds three **candidate** images for that commit: `boringstack-api`,
   `boringstack-migrations` and `boringstack-ui`, tagged `candidate-<sha>`.
   Nothing moves `latest` or `sha-*` for this target.
3. Only after all three builds succeed, makes **one** commit that pins all three
   digests in `overlays/prod/kustomization.yaml`. A failed or interrupted build
   leaves production unchanged. A non-fast-forward push fails without retry.

The Compose/WUD path is unchanged. `apps-api-release.yml` and
`apps-ui-release.yml` still publish `latest` and `sha-*` for WUD. Kubernetes never
references those tags, so a partial Compose publish cannot reach this target.

### Activation (required before the first release)

1. Fresh fork: nothing to remove.
2. Existing Argo Application that still has `argocd-image-updater.argoproj.io/*`
   annotations, or an image-updater watching these images: remove those
   annotations and the updater's write-back for this app first. Otherwise it can
   overwrite the coordinated digests with per-image tags. Let any running
   per-image release finish, and record the current digests for rollback.
3. Set the GitHub repository variable `PRODUCTION_RELEASE_MODE=coordinated`.
   Without it, the release fails before any image is built. The variable is an
   operator assertion, not a live check.
4. Repository policy must allow `github-actions[bot]` to push the promotion
   commit to `main`. If branch protection blocks it, promotion fails closed.
   Do not disable protection to make a release pass.

### Release contract and rollback

- Argo performs a **full application sync** in wave order: infrastructure at
  -4/-2, the migration Job at -1, the API at 0, the UI at 1 once the API is
  healthy. Do not selectively sync Deployments: that bypasses the migration hook
  and wave ordering.
- A successful workflow means the digests were promoted, not that Argo has
  finished. Check Synced/Healthy, then smoke-test sign-in and the main screens.
- API and database changes must stay compatible with the previous UI during the
  rollout.
- To roll back application images, restore **all three digests from one previous
  promotion** in a reviewed commit, then sync the whole Application.
- Migrations are not reversed automatically. Confirm the previous API works with
  the current schema before rolling back.

## Migrations and seeds

The migration Job runs `bun run db:migrate` (drizzle-kit migrate) and nothing
else. It is an Argo `Sync` hook at wave -1, so it runs on **every** sync, and any
data it writes lands on a live database. For that reason:

- The Job never runs `db:seed` or `db:prepare`. `db:seed` upserts reference
  data, so it would revert admin edits on each sync. A test enforces this.
- Reference data that the product needs must be insert-if-missing, and it is
  applied deliberately, not on every sync.
- The first administrator is a one-off, and it is idempotent. Run it once with
  the migrations image from the same release. Use the candidate tag for the
  promoted commit (the promotion commit names it):

  ```bash
  SHA=<promoted source commit>
  kubectl -n boringstack-prod run superuser-bootstrap --rm -i --restart=Never \
    --image=ghcr.io/boringstack-xyz/boringstack-migrations:candidate-$SHA \
    --overrides='{"spec":{"serviceAccountName":"api","nodeSelector":{"kubernetes.io/arch":"amd64"},"imagePullSecrets":[{"name":"ghcr-registry-secret"}],"containers":[{"name":"superuser-bootstrap","image":"ghcr.io/boringstack-xyz/boringstack-migrations:candidate-'"$SHA"'","envFrom":[{"secretRef":{"name":"boringstack-secrets"}}],"env":[{"name":"NODE_ENV","value":"production"},{"name":"DATABASE_URL","valueFrom":{"secretKeyRef":{"name":"boringstack-db-app","key":"uri"}}},{"name":"DATABASE_SSL_CA","valueFrom":{"secretKeyRef":{"name":"boringstack-db-ca","key":"ca.crt"}}}]}]}}' \
    -- bun run db:seed
  ```

  It needs `SUPERUSER_EMAIL` and `SUPERUSER_PASSWORD` in `boringstack-secrets`.
  It creates the admin only if that user does not exist. Without those values it
  does nothing, and users can sign up instead.
- A from-scratch rebuild of reference data is also a one-off run of the seed
  command, never a change to the Job.

## Deploy

1. Rebrand and edit the knobs above.
2. Populate secrets via your chosen backend.
3. Register with ArgoCD, either:
   - `kubectl apply -f infra/k3s/argocd/boringstack-prod.yaml`, or
   - add `argocd/app-of-apps-registration.example.yaml` to your app-of-apps repo.
4. Complete [activation](#activation-required-before-the-first-release).
5. Merge to `main`. The release workflow publishes the three candidates and
   promotes them in one commit. Argo then syncs. Watch the Application reach
   Healthy.
6. Run the one-off superuser bootstrap if you want a first admin.

Startup order is set by waves: namespace and secrets (-4), Postgres and Valkey
(-2), migrations (-1), API (0), UI (1).

## Verify

```bash
# Structural render (no cluster needed)
kubectl kustomize infra/k3s/overlays/prod | head

# Release invariants on the real render (digest pins, no image-updater,
# migrate-only Job, read-only API, CA wiring, network policy, release script)
bun test infra/k3s/tests scripts/release

# Live
kubectl -n boringstack-prod get pods
curl -sI https://<domain>/health        # 200 from the api
curl -sI https://<domain>/              # 200 from the ui (SPA)
```

## Runtime notes

- The API image runs on a read-only root filesystem. Its CMD is
  `bun --no-install run dist/index.js`, so bun never tries to install packages at
  startup (that attempt fails with `EROFS`). Only `/tmp` (256 MiB) is writable,
  and Bun's transpiler cache lives there.
- The API and the migration Job share one TLS policy for Postgres
  (`apps/api/src/lib/postgres/connection.ts`), driven by `DATABASE_SSL_CA`. Keep
  TLS settings in `DATABASE_SSL_*`, not in `sslmode` on the URL.
- Valkey uses AOF with `everysec` fsync so queued BullMQ jobs survive a restart.

## What's intentionally not here

- In-cluster Prometheus/Grafana/Loki. Integrate with the cluster's stack
  (`overlays/prod/monitoring/`).
- Provisioning the cluster itself. Bring your own k3s.
- App code. That's `apps/api` and `apps/ui`.
