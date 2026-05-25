---
name: article-illustrations
description: >-
  Generate and integrate cover and section illustrations for the BoringStack
  docs site (boringstack.xyz, Astro Starlight MDX). Use when asked to illustrate
  a docs page, add images to a guide or runbook, or generate visuals for
  src/content/docs.
---

# Article illustrations (BoringStack docs)

This repo is **boringstack-docs**: an [Astro Starlight](https://starlight.astro.build) site under `.github/`. Documentation pages live as **MDX** in `src/content/docs/` (mirrored in the sidebar from `astro.config.mjs`). There is **no** `pnpm optimize:image` or `process:transparency` script here; use the workflow below with normal static assets and `npm run build` to verify.

## Prerequisites

- The target page already exists: `src/content/docs/**/*.mdx` with frontmatter (`title`, `description`, …) and `##` section headings where you want art.
- The `GenerateImage` tool is available (or another agreed image pipeline).
- From `.github/`: `npm install` done; after adding assets, run `npm run build`.

## Paths and URLs

| Role | Location | How MDX references it |
|------|----------|------------------------|
| Static images (preferred) | `public/images/docs/` | `![alt text](/images/docs/your-file.webp)` |
| Optional co-located assets | e.g. `public/images/docs/quickstart/` | Same, with subpath in URL |

Starlight serves `public/` at the site root, so `/images/docs/...` is the stable URL on https://boringstack.xyz/.

## Workflow

### Step 1: Read the page

Read the MDX file. Extract:

- **Title** from frontmatter `title` (and `description` for tone).
- **Slug** from the file path, e.g. `src/content/docs/runbooks/firewall-and-tls.mdx` → logical slug `firewall-and-tls` (use a short folder+name prefix for image filenames).
- Every **`##` heading** that should get a section illustration.
- A one-line **theme** per section for prompts.

### Step 2: Optional hero / social image

Most Starlight doc pages do not use a giant cover. If you add a strong visual for the **splash** home page only (`src/content/docs/index.mdx`), keep Starlight’s frontmatter rules: do not invent unsupported keys; prefer in-page `<Image />` or a normal markdown image in the hero body if the template allows.

For ordinary guides, skip a separate “cover” unless the user asks for Open Graph / social imagery (then follow current Starlight docs for `image` / social cards for that version).

### Step 3: Generate section illustrations

For each chosen `##` section, generate one image with `GenerateImage`.

**Style** (same creative direction as before, tuned for technical docs): simplistic **white-line sketch on pure black (#000000)**. Minimal detail, hand-drawn feel, single subject, no text, no UI chrome, no logos.

**Prompt template:**

```
Simplistic white-line sketch on a pure black (#000000) background. [SUBJECT for this section].
Minimal detail, single continuous line style, hand-drawn feel. No shading, no gradients,
no background elements. White lines only on solid black.
```

**Naming:** `{page-slug}-{short-section-id}.webp` (or `.png` then convert), e.g. `firewall-and-tls-acme-flow.webp`, stored under `public/images/docs/` or a subfolder per page.

**Reference images:** If the repo already has docs images under `public/images/docs/`, pass one as `reference_image_paths` for style consistency. Otherwise use the first approved sketch from this session.

### Step 4: Optimize file size

This package does not ship image scripts. Before committing:

- Prefer **WebP** (quality ~75–85) for photos or complex sketches.
- Keep section sketches roughly **under ~150 KB** each when reasonable (tune quality or dimensions).
- Use any local tool you have (`cwebp`, ImageMagick, `sharp` CLI, etc.) or export WebP directly from the generator.

### Step 5: Theme (light / dark)

Starlight supports theme switching. **White-on-black line art** can look wrong on light backgrounds without extra CSS.

- **Default recommendation:** keep sketches high-contrast and simple so they read in both modes, **or** use neutral mid-tone line art on transparent PNG (harder to generate consistently).
- **If** you add a global rule for inverted sketches, do it via Starlight’s `customCss` in `astro.config.mjs` pointing at a file under `src/` (create the stylesheet if needed). Do not assume `src/styles/global.css` exists; it does not in this repo today.

### Step 6: Insert into MDX

Place the markdown **immediately after** the `##` heading, before the first paragraph:

```mdx
## Firewall and TLS on a VPS

![TLS handshake and padlock metaphor](/images/docs/firewall-and-tls-tls-sketch.webp)

First paragraph of the section...
```

Do not break Starlight imports or components at the top of the file; only add images in the markdown body.

### Step 7: Verify

```bash
cd .github
npm run build
```

Fix broken paths or oversized assets if the build or Pagefind step complains.

### Step 8: Clean up

Remove stray `.png` intermediates from the workspace if you converted to WebP and no longer need the sources. Only commit intentional finals under `public/images/docs/` (plus the edited MDX).

## File conventions summary

| Type | Directory | Referenced from MDX |
|------|-----------|---------------------|
| Section sketch | `public/images/docs/` (optional subdirs) | `![alt](/images/docs/...)` |

## Prompt crafting tips

- See [STYLE-GUIDE.md](STYLE-GUIDE.md) for longer prompt patterns and mapping headings to subjects.
- For **infra / runbook** pages, favor concrete objects (server, lock, envelope, pipeline) over abstract “cloud” blobs.
- Always include **negative** constraints: no text, no UI, no watermarks, no gradients unless you explicitly want them.
