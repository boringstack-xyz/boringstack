# BoringStack public site

A static marketing site: landing, pricing, about, contact, legal stubs and a blog
from Markdown. Astro renders everything at build time. nginx serves the result.
The site has no server code and calls no API.

## Local development

Run the Compose dev stack (`infra/compose/compose/dev.sh`, where `WITH_SITE` is on by default),
which starts `site-dev` at http://localhost:7333 with live reload. Or outside Docker:

```bash
cd apps/site
bun install --frozen-lockfile
bun run dev          # http://localhost:7333, with localhost SITE_URL and APP_URL
```

Sign-up and sign-in links point at `APP_URL` (default http://localhost:7331).

## Validate

```bash
bun run validate
```

This runs format, types, unit tests (including invalid-configuration builds that
must fail), the production-config build, the rendered nginx config and the output
checks against `dist/`.

## The domain split

| Origin                    | Serves                                       |
| ------------------------- | -------------------------------------------- |
| `https://example.com`     | this site (static, apex, indexable)          |
| `https://app.example.com` | `apps/ui` and `/api` (the authenticated app) |

Set `SITE_URL` to the apex and `APP_URL` to `app.<domain>`. They must be different
origins, so public pages and app pages never share cookies or search indexing. The
app's own `FRONTEND_URL` and `VITE_PUBLIC_URL` should equal `APP_URL`. The site makes
no API calls, so it needs no CORS entry in `ALLOWED_ORIGINS`.

## Configuration

See [`.env.example`](.env.example) and [docs/agents/config.md](docs/agents/config.md).
Configuration is validated when Astro loads its config. An invalid value fails the
build (and `docker build`), never container start. A public-origin build needs
`CONTACT_EMAIL`.

## Content

- Pages live in `src/pages`. Shared head and metadata are in `src/components/Seo.astro`.
- Blog posts are Markdown files in `src/content/blog`. The filename is the permanent
  URL. `draft` defaults to `true`; set it to `false` deliberately.
- Placeholder copy is marked "Placeholder". Replace it before launch.

## Privacy

No cookies are set. Analytics is off unless `ANALYTICS_SCRIPT_URL` and
`ANALYTICS_WEBSITE_ID` are both set. Then a consent banner appears, and the script
loads only after the visitor accepts. The banner is not rendered when analytics is off.

## Production image

```bash
docker build -t boringstack-site \
  --build-arg SITE_URL=https://example.com \
  --build-arg APP_URL=https://app.example.com \
  --build-arg CONTACT_EMAIL=hello@example.com .
docker run --rm --read-only --tmpfs /tmp -p 8080:8080 boringstack-site
```

The container listens on 8080 as a non-root user, reads nothing but its own files, and
writes only under `/tmp`. Readiness and liveness: `GET /healthz`.
