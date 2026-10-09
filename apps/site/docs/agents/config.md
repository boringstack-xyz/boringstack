# Configuration

All configuration is build-time. `astro.config.mjs` reads it through
`src/lib/config-core.mjs`, the one implementation shared with the nginx renderer and
the tests. The result reaches pages as the global `__SITE_CONFIG__` (see
`src/lib/site-config.ts`), so pages never read `process.env` themselves.

| Variable               | Required      | Rule                                                                      |
| ---------------------- | ------------- | ------------------------------------------------------------------------- |
| `SITE_URL`             | yes           | Origin only. https outside localhost. Canonical origin for every URL.     |
| `APP_URL`              | yes           | Origin only. Must differ from `SITE_URL`.                                 |
| `CONTACT_EMAIL`        | public origin | Valid email. Required when `SITE_URL` is not localhost.                   |
| `ANALYTICS_SCRIPT_URL` | no            | https origin of an analytics script. Both analytics variables or neither. |
| `ANALYTICS_WEBSITE_ID` | no            | 1-64 letters, digits, `-` or `_`. Sent as `data-website-id`.              |

Rules that must not regress:

- Invalid configuration throws during `astro build`. The Dockerfile runs the build,
  so `docker build` fails. Nothing validates at container start.
- Localhost builds are `noindex` and `Disallow: /`, so a dev build cannot be indexed.
- The Content-Security-Policy allows the analytics origin for `script-src` and
  `connect-src` only, and only when configured. Otherwise it is `'self'` only.
- The consent banner exists only when analytics is configured. With no analytics
  there is nothing to consent to.

Production values for the image live in `infra/k3s/overlays/prod/site-build.env`. CI
passes them as build arguments. Compose builds them from `PUBLIC_SITE_HOST`,
`PUBLIC_UI_HOST`, `SITE_CONTACT_EMAIL` and `SITE_ANALYTICS_*`.
