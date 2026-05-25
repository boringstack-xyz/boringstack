# Deploy: boringstack.xyz on Cloudflare Pages

The site in `apps/docs/` is an [Astro Starlight](https://starlight.astro.build) docs site. It builds to static files, deploys to [Cloudflare Pages](https://pages.cloudflare.com), and is served at https://boringstack.xyz.

This file documents the wire-up so future-you (or a teammate) can rebuild it from scratch if needed.

## One-time setup

1. **Cloudflare account.** Use the same one that owns the `boringstack.xyz` DNS zone.

2. **Create a Pages project.**
   - Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git.
   - Authorize the `boringstack-xyz` GitHub org.
   - Select the monorepo (docs root: `apps/docs`).
   - Project name: `boringstack-docs` (becomes the `*.pages.dev` subdomain).

3. **Build settings.**

   | Setting                | Value               |
   | ---------------------- | ------------------- |
   | Production branch      | `main`              |
   | Framework preset       | Astro               |
   | Build command          | `pnpm build`        |
   | Build output directory | `dist`              |
   | Root directory         | `apps/docs`         |
   | Node version           | `22` (via `.nvmrc`) |
   | Environment variables  | _(none)_            |

4. **Custom domain.**
   - Pages project → Custom domains → Set up a custom domain → `boringstack.xyz`.
   - Cloudflare auto-creates the DNS CNAME (zone is already on Cloudflare).
   - Cert is provisioned automatically; usually live in under a minute.
   - Add `www.boringstack.xyz` the same way if desired (redirect handled in the CF dashboard).

## Build locally

```bash
cd apps/docs
pnpm install
pnpm dev       # local preview at http://localhost:4321
pnpm build:site     # produces dist/ (Cloudflare uses this; no sibling templates needed)
pnpm build:ci       # check:docs-data + build; same as docs-linkcheck CI
pnpm preview   # serves dist/ at http://localhost:4321
```

The build runs Pagefind automatically (Starlight bundles it), so search works on the built site too.

## How deploys work

- Push to `main` → Cloudflare auto-builds with `pnpm build` (Astro only; committed JSON in `src/data/` is the catalog source of truth).
- Manual production deploy: `pnpm deploy` runs `build:ci` (docs-data check + build) before `wrangler deploy`. From the monorepo, defaults use `apps/ui` and `apps/api` (override with `BORINGSTACK_UI_DIR` / `BORINGSTACK_API_DIR`).
- Pushes to other branches → preview deployment at `<branch>.boringstack-docs.pages.dev`.
- PRs from forks get preview deployments too (CF Pages comments the URL on the PR).
- Rollback: Pages dashboard → Deployments → pick a previous deployment → Rollback.

## Notes

- **No CNAME file.** Unlike GitHub Pages, Cloudflare Pages binds the custom domain via the dashboard, not via a `public/CNAME` file. Adding one would just serve `/CNAME` as text.
- **Sitemap.** Starlight generates `sitemap-index.xml` and `sitemap-0.xml` during `pnpm build`. Pagefind plus the sidebar remains the primary human navigation.
- **Analytics.** Not wired up. If you add Cloudflare Web Analytics later, drop the `<script>` into `astro.config.mjs` via Starlight's `head` option.
