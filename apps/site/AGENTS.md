# Public site: index

Static marketing site (Astro, `output: "static"`) served by nginx. The
authenticated app is `apps/ui`; this site links to it for sign-up and sign-in.
[README.md](README.md) covers local development and the domain split.

`bun run validate` is the gate: format, types, unit tests, production-config build,
rendered nginx config and output checks. If a guide below disagrees with what
`validate` says, the lint config wins.

## Deep dives

| When you're doing this                                                 | Read this                         |
| ---------------------------------------------------------------------- | --------------------------------- |
| Adding or changing `SITE_URL`, `APP_URL`, `CONTACT_EMAIL`, analytics   | [config](docs/agents/config.md)   |
| Adding a page, a blog post, or changing SEO, cards and structured data | [content](docs/agents/content.md) |
| Building the image, nginx headers and CSP, Compose and k3s wiring      | [deploy](docs/agents/deploy.md)   |
