# Deploy: image, nginx, Compose and k3s

## Image

`Dockerfile` has four stages:

1. `deps`: `bun install --frozen-lockfile`.
2. `dev`: the Astro dev server, used by Compose `site-dev`.
3. `build`: `astro build` then `render-nginx.mjs`. It writes `.build/nginx.conf`, with the
   CSP derived from the same validated configuration.
4. `production`: `nginx:1.31-alpine`, pinned by digest, as the non-root user `app`
   (uid 1001), listening on 8080. It runs `nginx -t` at build time.

The container writes only to `/tmp`. It creates nginx's temp directories when it starts,
so run it with `--read-only --tmpfs /tmp` or an `emptyDir` at `/tmp`.

## nginx headers and cache

Security headers are declared once at server level, since an `add_header` inside a
location replaces the server's headers. They are: CSP, `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and
`Cross-Origin-Opener-Policy`. HSTS is set by the ingress, which terminates TLS.

Cache policy, keyed on status and path:

- `/_astro/*` (hashed assets): `public, max-age=31536000, immutable`.
- Successful images and fonts: `public, max-age=86400`.
- HTML and everything else: `no-cache`.
- Errors: `no-store`.

## Compose

`docker-compose.site.yml` is merged when `WITH_SITE=1` (default in dev, `0` in prod).

- Dev: `site-dev` on `SITE_HOST_PORT` (default 7333).
- Prod: `site` routed by Traefik on `Host(PUBLIC_SITE_HOST)`. The app stays on
  `PUBLIC_UI_HOST`. `dev.sh` requires `PUBLIC_SITE_HOST` (different from the app host),
  `SITE_CONTACT_EMAIL` and a pinned `SITE_IMAGE_TAG` (never `latest`).

Guardrails in `infra/compose/scripts/validate-guardrails.sh` cover the site: healthcheck,
`no-new-privileges`, resource reservations and digest-pinned images.

## k3s

`infra/k3s/base/site` holds the Deployment, Service, NetworkPolicy and ServiceAccount.
The Deployment uses a read-only root filesystem, drops all capabilities, runs as uid
1001, has probes on `/healthz`, and mounts `/tmp` as an `emptyDir`. The NetworkPolicy
allows ingress from Traefik and DNS egress only.

The prod overlay routes:

- `Host(<apex>)` to `site:8080` (`boringstack-site` IngressRoute).
- `Host(app.<apex>)` to `api` for `/api` and `/health`, and to `ui` for everything else.
- The certificate covers the apex, `app.<apex>` and the GlitchTip host.
- `site-pdb` keeps one replica available. `patches/site-replicas.yaml` runs two replicas
  with spread constraints.

Image updates: `.github/workflows/production-release.yml` builds the site as a
`candidate-<sha>` image with the API, migrations and UI, and pins all four digests
in one commit. Nothing watches tags.

## Release

For Kubernetes, `.github/workflows/production-release.yml` builds the site image with
the build arguments from `infra/k3s/overlays/prod/site-build.env`. For the Compose/WUD
path, `.github/workflows/apps-site-release.yml` publishes `latest` and `sha-*` tags
built from the same file.
`.github/workflows/apps-site-validate.yml` runs `bun run validate`, builds the same
image and smoke-tests it read-only.
