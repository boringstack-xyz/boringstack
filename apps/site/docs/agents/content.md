# Content, SEO and social cards

## Pages

Pages are `.astro` files in `src/pages`. Each renders through `BaseLayout`, which
supplies the head through `Seo.astro`:

- `title` and `description` are required. The title gains the site name suffix.
- `image` defaults to `/og/default.png`. A post uses `/og/blog/<slug>.png`.
- `noindex` marks a page; the 404 page uses it.

Links use paths without trailing slashes (`/blog/hello-world`). nginx redirects the
alternatives, and the canonical tag is always the slashless form. Check output with
`bun run test:output`.

## Blog

Posts are flat Markdown files in `src/content/blog`, validated by `src/content.config.ts`:
`title`, `description`, `publishedAt` (YYYY-MM-DD), optional `updatedAt`, `author`,
and `draft` (default `true`). A draft is absent from the index, the post route, the
sitemap and the social card routes. Scheduled posts stay hidden until a build on or
after their date. The filename is the permanent URL, so renaming a published post
breaks its link.

## Structured data

- Home: `Organization` and `WebSite` JSON-LD.
- Posts: `BlogPosting` with `mainEntityOfPage`, dates and image.
- Every page: `WebPage`.

`jsonLd()` in `src/lib/seo.ts` escapes `<`, so no value can close the script element.

## Social cards

`src/lib/social-card.ts` renders 1200x630 PNGs at build time with Satori and Sharp.
Satori lays out plain element objects, so no React runtime is needed. The bundled
Manrope fonts (`@fontsource/manrope`, WOFF) keep the output independent of container
fonts. Endpoints: `src/pages/og/default.png.ts` and `src/pages/og/blog/[slug].png.ts`.

## Sitemap and robots

`@astrojs/sitemap` emits `sitemap-index.xml`, excluding `/404` and `/og/`.
`robots.txt` points at the index on indexable origins and disallows everything on
localhost.

## Optional ideas, not implemented

- An RSS feed for the blog.
- Per-page `lastmod` taken from `updatedAt` in the sitemap.
- Breadcrumb structured data for the blog.
