# Traefik (prod-only)

This template runs **Traefik v3** in the **prod profile only**, where it terminates TLS via Let's Encrypt ACME (HTTP-01) and **path-routes a single domain**: `/api/*` and `/health` go to the api container, everything else goes to the ui container. One TLS cert, one host, no CORS, no `api.` subdomain.

In dev there's **no Traefik** — Vite's dev-server proxy forwards `/api/*` to `api-dev` over the docker network, so the browser only ever sees `http://localhost:3001`.

If you lock down **port 80** on the origin, HTTP-01 renewal can fail; prefer **DNS-01** for ACME in that case (see [runbooks/firewall-and-tls](../docs/runbooks/firewall-and-tls.md)).

## Files

| File | Role |
| --- | --- |
| [compose/docker-compose.yml](../compose/docker-compose.yml) | Always-on: postgres, valkey. `api`/`ui` in prod, `api-dev`/`ui-dev` in dev. Traefik in prod only. |
| [compose/docker-compose.development-labels.yml](../compose/docker-compose.development-labels.yml) | Publishes data-service host ports (postgres:5432, valkey:6379). No Traefik labels. |
| [compose/docker-compose.production-labels.yml](../compose/docker-compose.production-labels.yml) | Traefik command, ACME, security-header middleware, path-routing labels on the `api` and `ui` services. |

## Dev stack (`STACK=dev`, default)

1. Lay out **siblings**: `api-template`, `ui-template`, and `infra-docker-compose-template` under the same parent directory.

2. Copy [compose/.env.example](../compose/.env.example) to `compose/.env`.

3. Start the stack:

   ```bash
   ./scripts/compose-up.sh
   ```

4. Open `http://localhost:3001` in your browser.

The SPA runs on Vite's dev server. Any request to `/api/*` is proxied server-side by Vite to `api-dev:3000` inside the docker network. From the browser's perspective everything is same-origin, so no CORS preflights happen.

## Prod stack (`STACK=prod`)

Builds `api` and `ui` from sibling clones using `Dockerfile.prod`, wires Let's Encrypt on `web` (HTTP-01), and terminates TLS on `websecure`. Traefik routes:

| Rule | Goes to | Notes |
| --- | --- | --- |
| `Host(${PUBLIC_UI_HOST}) && (PathPrefix(/api) || Path(/health))` | `api` | Higher priority — matches first. No path stripping; Elysia already serves at `/api/v1/*`. |
| `Host(${PUBLIC_UI_HOST})` | `ui` | Fallback for the SPA shell and its assets. |

1. Set in `compose/.env`:
   - `STACK=prod`
   - `PUBLIC_UI_HOST` (real FQDN, e.g. `example.com`)
   - `ACME_EMAIL` (contact for Let's Encrypt)

2. Copy [compose/api.prod.env.example](../compose/api.prod.env.example) to `compose/api.prod.env` and fill in the API's environment.

3. Start:

   ```bash
   STACK=prod ./scripts/compose-up.sh
   ```

4. Read [runbooks/firewall-and-tls](../docs/runbooks/firewall-and-tls.md) before locking the host behind Cloudflare-only origins, or HTTP-01 renewal will fail.

## Where security headers live

Traefik in `production-labels.yml` is the **single source of truth** for HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and CSP (on the ui router). The nginx config in `ui-template/` is intentionally minimal — file serving and cache-control only. The api has no helmet middleware.

## Observability alongside Traefik

Optional Prometheus / Grafana uses Compose profile `observability`. Grafana publishes on host port 3010 so it does not collide with Traefik's 80/443 in prod.

```bash
WITH_OBSERVABILITY=1 ./scripts/compose-up.sh
```

Stop with the same `WITH_OBSERVABILITY` and `STACK` values you used to start.

## Merge commands (reference)

Dev (no Traefik):

```text
docker compose -f docker-compose.yml -f docker-compose.development-labels.yml --profile dev up -d
```

Prod (Traefik on, path-routed):

```text
docker compose -f docker-compose.yml -f docker-compose.production-labels.yml --profile prod up -d
```
