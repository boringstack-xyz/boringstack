import { execSync } from "node:child_process";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import mermaid from "astro-mermaid";
import remarkGfm from "remark-gfm";
import starlightLlmsTxt from "starlight-llms-txt";

// Wrap every <table> so wide content stays keyboard-scrollable in Safari/Firefox.
// Without this, axe-core flags "scrollable-region-focusable" on horizontally
// overflowing tables (comparison tables, env tables, cost methodology).
function rehypeAccessibleTables() {
  return (tree) => {
    const visit = (node, parent, index) => {
      if (!node || typeof node !== "object") return;
      if (
        node.type === "element" &&
        node.tagName === "table" &&
        parent &&
        !(
          parent.type === "element" &&
          parent.tagName === "div" &&
          parent.properties?.role === "region"
        )
      ) {
        const wrapper = {
          type: "element",
          tagName: "div",
          properties: {
            role: "region",
            "aria-label": "Scrollable table",
            tabIndex: 0,
            className: ["bs-table-scroll"],
          },
          children: [node],
        };
        parent.children[index] = wrapper;
        return;
      }
      if (Array.isArray(node.children)) {
        for (let i = 0; i < node.children.length; i++) {
          visit(node.children[i], node, i);
        }
      }
    };
    visit(tree, null, 0);
  };
}

// Map each docs entry to the ISO timestamp of its most recent git commit.
// Empty Map when git history is unavailable (shallow CI clones, etc.).
function buildDocsLastmodMap() {
  const map = new Map();
  try {
    const out = execSync(
      "git log --pretty=format:%cI --name-only --diff-filter=AMR -- 'src/content/docs/**/*.mdx' 'src/content/docs/**/*.md'",
      { encoding: "utf-8" },
    );
    let currentDate = "";
    for (const raw of out.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (/^\d{4}-\d{2}-\d{2}T/.test(line)) {
        currentDate = line;
      } else if (currentDate && !map.has(line)) {
        map.set(line, currentDate);
      }
    }
  } catch {
    // No git history available. Leave the map empty.
  }
  return map;
}

const docsLastmod = buildDocsLastmodMap();

function lastmodForUrl(absoluteUrl) {
  try {
    const { pathname } = new URL(absoluteUrl);
    const slug = pathname.replace(/^\/|\/$/g, "") || "index";
    for (const ext of ["mdx", "md"]) {
      const candidate = `src/content/docs/${slug}.${ext}`;
      if (docsLastmod.has(candidate)) {
        return docsLastmod.get(candidate);
      }
    }
  } catch {}
  return undefined;
}

// https://astro.build/config
export default defineConfig({
  site: "https://boringstack.xyz",
  /*
   * Fully static build. Every page in this Starlight site is
   * prerendered at build time and served by Cloudflare Pages as
   * static assets. There is no Cloudflare adapter (no SSR), so
   * Astro emits HTML/JS/CSS into `dist/` and wrangler uploads it
   * as an assets-only deploy (see `wrangler.jsonc`). `output:
   * "static"` is the documented default for adapter-less sites
   * and we pin it explicitly so the intent is unmistakable.
   */
  output: "static",
  redirects: {
    "/architecture/three-repos/": "/architecture/monorepo-layout/",
  },

  markdown: {
    // GFM is normally Astro's default, but Starlight's MDX pipeline was not
    // emitting <table>/<del> for pipe tables and strikethrough — every table
    // in the docs rendered as literal `| … |` text. Wiring remark-gfm
    // explicitly restores GFM table/strikethrough/autolink parsing.
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeAccessibleTables],
  },

  integrations: [
    sitemap({
      serialize(item) {
        const lastmod = lastmodForUrl(item.url);
        if (lastmod) {
          item.lastmod = lastmod;
        }
        return item;
      },
    }),
    react(),
    mermaid({
      theme: "base",
      autoTheme: true,
      mermaidConfig: {
        // Clean vector look: sharper, "futuristic" reads better than rough.js sketch
        // for the BoringStack brand. CSS in custom.css adds neon glow + gradient
        // border chrome on top of the mermaid output.
        look: "classic",
        flowchart: {
          curve: "basis",
          padding: 26,
          nodeSpacing: 60,
          rankSpacing: 70,
          useMaxWidth: true,
        },
        sequence: {
          actorMargin: 60,
          messageMargin: 40,
          wrap: true,
          useMaxWidth: true,
        },
        themeVariables: {
          // Surfaces: Starlight owns the page background.
          background: "transparent",
          mainBkg: "rgba(74, 222, 128, 0.14)",
          secondBkg: "rgba(103, 232, 249, 0.10)",
          tertiaryColor: "rgba(240, 171, 252, 0.10)",
          clusterBkg: "rgba(74, 222, 128, 0.05)",
          clusterBorder: "rgba(134, 239, 172, 0.42)",

          // Primary palette: emerald, the BoringStack accent.
          primaryColor: "rgba(74, 222, 128, 0.16)",
          primaryBorderColor: "#4ade80",
          primaryTextColor: "#f0fdf4",

          // Secondary palette: cyan accent for alt nodes.
          secondaryColor: "rgba(103, 232, 249, 0.12)",
          secondaryBorderColor: "#67e8f9",
          secondaryTextColor: "#cffafe",

          // Tertiary palette: pink accent.
          tertiaryBorderColor: "#f0abfc",
          tertiaryTextColor: "#fae8ff",

          // Edges / lines.
          lineColor: "#86efac",
          arrowheadColor: "#86efac",

          // Text & default node.
          textColor: "#f0fdf4",
          nodeBorder: "#4ade80",
          nodeTextColor: "#f0fdf4",
          titleColor: "#dcfce7",

          // Edge label chips: mermaid paints a `.labelBkg` div per edge even when
          // there's no label. We restore the colored backing so real labels cover
          // the edge line behind their text, then strip empty edge labels via JS
          // (see the wireMermaidCleanup head script).
          edgeLabelBackground: "rgba(13, 15, 18, 0.92)",
          labelBackground: "rgba(13, 15, 18, 0.92)",
          labelTextColor: "#f0fdf4",
          labelBoxBorderColor: "transparent",

          // Notes (sequence / generic).
          noteBkgColor: "rgba(134, 239, 172, 0.12)",
          noteTextColor: "#dcfce7",
          noteBorderColor: "#4ade80",

          // Sequence diagram surfaces.
          actorBkg: "rgba(74, 222, 128, 0.16)",
          actorBorder: "#4ade80",
          actorTextColor: "#f0fdf4",
          actorLineColor: "rgba(134, 239, 172, 0.4)",
          signalColor: "#86efac",
          signalTextColor: "#f0fdf4",
          loopTextColor: "#dcfce7",
          activationBkgColor: "rgba(74, 222, 128, 0.22)",
          activationBorderColor: "#4ade80",
          sequenceNumberColor: "#0b0d11",

          // Typography.
          fontFamily:
            "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          fontSize: "14px",
        },
      },
    }),
    starlight({
      title: "BoringStack",
      description:
        "The production-grade SaaS starter. Auth, billing, queues, email, observability — already wired. Skip months of setup. Ship product on day one. MIT, open source.",
      favicon: "/favicon.svg",
      customCss: ["./src/styles/tailwind.css", "./src/styles/custom.css"],
      plugins: [
        starlightLlmsTxt({
          projectName: "BoringStack",
          description:
            "UI, API, and infra GitHub templates: React, Bun, Elysia, Postgres, Valkey, Docker Compose, OpenTofu, and ESLint plugins. OpenAPI contract between API and UI.",
          rawContent: true,
          exclude: ["index", "404"],
        }),
      ],
      tableOfContents: false,
      components: {
        Footer: "./src/components/Footer.astro",
        Header: "./src/components/Header.astro",
        PageTitle: "./src/components/PageTitle.astro",
        Pagination: "./src/components/Pagination.astro",
        ThemeProvider: "./src/components/ThemeProvider.astro",
      },
      head: [
        /*
         * Open Graph + Twitter card meta. Starlight injects og:title and
         * og:description from frontmatter automatically, but it does NOT
         * inject og:image — without these tags every LinkedIn / Twitter /
         * Slack share shows a bare title block. The `og-image.png` is
         * generated by `scripts/generate-og-image.mjs` and committed so
         * a freshly-cloned template renders previews on first deploy.
         */
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: "https://boringstack.xyz/og-image.png",
          },
        },
        {
          tag: "meta",
          attrs: { property: "og:image:width", content: "1200" },
        },
        {
          tag: "meta",
          attrs: { property: "og:image:height", content: "630" },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image:alt",
            content:
              "Skip the boring stuff. Ship the rest. — BoringStack, the production-grade SaaS starter. Auth, billing, queues, email, observability already wired. MIT, open source.",
          },
        },
        {
          tag: "meta",
          attrs: { property: "og:type", content: "website" },
        },
        {
          tag: "meta",
          attrs: { property: "og:site_name", content: "BoringStack" },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:url",
            content: "https://boringstack.xyz/",
          },
        },
        {
          tag: "meta",
          attrs: { name: "twitter:card", content: "summary_large_image" },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content: "https://boringstack.xyz/og-image.png",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image:alt",
            content:
              "Skip the boring stuff. Ship the rest. — BoringStack, the production-grade SaaS starter. Auth, billing, queues, email, observability already wired. MIT, open source.",
          },
        },
        {
          tag: "script",
          content: `
(function () {
  function openZoom(svg) {
    var dialog = document.createElement("dialog");
    dialog.className = "mermaid-zoom-dialog";

    var close = document.createElement("button");
    close.className = "mermaid-zoom-close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "\\u00d7";
    close.addEventListener("click", function (e) {
      e.stopPropagation();
      dialog.close();
    });
    dialog.appendChild(close);

    var clone = svg.cloneNode(true);
    clone.removeAttribute("style");
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    dialog.appendChild(clone);

    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", function () {
      dialog.remove();
    });

    document.body.appendChild(dialog);
    dialog.showModal();
  }

  function wireZoom() {
    var diagrams = document.querySelectorAll(".mermaid");
    for (var i = 0; i < diagrams.length; i++) {
      var el = diagrams[i];
      if (el.dataset.zoomBound === "1") continue;
      var svg = el.querySelector("svg");
      if (!svg) continue;
      el.dataset.zoomBound = "1";
      (function (target, sourceSvg) {
        target.addEventListener("click", function () {
          openZoom(sourceSvg);
        });
      })(el, svg);
    }
  }

  // Mermaid renders a <g class="edgeLabel"> for every edge, even unlabeled ones.
  // That stub contains an empty span/foreignObject + a colored .labelBkg div, which
  // surfaces as a tiny dark pill mid-edge. Hide stubs whose text is whitespace-only.
  function pruneEmptyEdgeLabels() {
    var labels = document.querySelectorAll(".mermaid g.edgeLabel");
    for (var i = 0; i < labels.length; i++) {
      var el = labels[i];
      if (el.dataset.bsPruned === "1") continue;
      var text = (el.textContent || "").replace(/\\s+/g, "");
      if (text.length === 0) {
        el.style.display = "none";
        el.dataset.bsPruned = "1";
      }
    }
  }

  function tick() {
    wireZoom();
    pruneEmptyEdgeLabels();
  }

  function start() {
    tick();
    // SVG can inject async after page-load; retry a few times
    [50, 200, 500, 1200, 2500].forEach(function (d) { setTimeout(tick, d); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
  document.addEventListener("astro:page-load", start);
})();
          `.trim(),
        },
        {
          tag: "script",
          content: `
(function () {
  var scrolledClass = "bs-nav-scrolled";

  function updateHeaderSurface() {
    document.documentElement.classList.toggle(scrolledClass, window.scrollY > 8);
  }

  function start() {
    updateHeaderSurface();
  }

  if (!window.__boringStackLandingBound) {
    window.__boringStackLandingBound = true;
    window.addEventListener("scroll", updateHeaderSurface, { passive: true });
    window.addEventListener("resize", updateHeaderSurface);
    document.addEventListener("astro:page-load", start);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
          `.trim(),
        },
      ],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/boringstack-xyz",
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/boringstack-xyz/boringstack/edit/main/apps/docs/",
      },
      lastUpdated: true,
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Welcome", link: "/" },
            { label: "Before you build", link: "/before-you-build/" },
            { label: "Quickstart", link: "/quickstart/" },
            {
              label: "First feature in 10 minutes",
              link: "/skills/first-feature-tutorial/",
            },
            {
              label: "Why BoringStack",
              link: "/architecture/why-boringstack/",
            },
            { label: "Deployment", link: "/topics/deployment/" },
          ],
        },
        {
          label: "Agent skills",
          items: [
            { label: "Overview", link: "/skills/" },
            { label: "Spec loop", link: "/skills/spec-loop/" },
          ],
        },
        {
          label: "Architecture",
          items: [
            {
              label: "Separation of concerns",
              link: "/architecture/separation-of-concerns/",
            },
            {
              label: "Background work",
              link: "/architecture/background-work/",
            },
            { label: "Repository layout", link: "/architecture/monorepo-layout/" },
            { label: "Stack at a glance", link: "/architecture/stack/" },
            { label: "CSRF stance", link: "/architecture/csrf-stance/" },
            { label: "Decision log", link: "/architecture/decisions/" },
            {
              label: "Agent critical",
              items: [
                {
                  label: "Lint as the contract",
                  link: "/architecture/lint-as-contract/",
                },
                {
                  label: "lint:meta rules",
                  link: "/architecture/lint-meta/",
                },
                {
                  label: "Agent docs as an index",
                  link: "/architecture/agent-docs/",
                },
              ],
            },
          ],
        },
        {
          label: "API template",
          items: [
            { label: "Overview", link: "/api/overview/" },
            { label: "Authentication", link: "/api/auth/" },
            { label: "Anonymous vs unauthorized", link: "/api/auth-contract/" },
            { label: "Two-factor authentication", link: "/api/mfa/" },
            { label: "Billing", link: "/api/billing/" },
            { label: "Email", link: "/api/email/" },
            { label: "Bounce handling", link: "/api/bounce-handling/" },
            { label: "Queues", link: "/api/queues/" },
            { label: "Audit log", link: "/api/audit-log/" },
            { label: "Notifications", link: "/api/notifications/" },
            { label: "ACL & feature resolution", link: "/api/acl/" },
            { label: "Multi-tenant model", link: "/api/multi-tenant/" },
            { label: "Env validator", link: "/api/env-validator/" },
          ],
        },
        {
          label: "UI template",
          items: [
            { label: "Overview", link: "/ui/overview/" },
            {
              label: "Architecture rules",
              link: "/ui/architecture-rules/",
            },
            { label: "OpenAPI client", link: "/ui/openapi-client/" },
            { label: "Notifications", link: "/ui/notifications/" },
            { label: "i18n", link: "/ui/i18n/" },
            { label: "Testing", link: "/ui/testing/" },
          ],
        },
        {
          label: "Infra template",
          items: [
            { label: "Overview", link: "/infra/overview/" },
            {
              label: "Profiles & overlays",
              link: "/infra/profiles-and-overlays/",
            },
            { label: "Resource limits", link: "/infra/resource-limits/" },
            { label: "Secrets", link: "/infra/secrets/" },
          ],
        },
        {
          label: "Topics",
          items: [
            { label: "Email in development", link: "/topics/email-in-dev/" },
            { label: "Cloudflare Email", link: "/topics/cloudflare-email/" },
            { label: "Error tracking", link: "/topics/error-tracking/" },
            { label: "Observability", link: "/topics/observability/" },
            { label: "Distributed tracing", link: "/topics/tracing/" },
            { label: "Alerts", link: "/topics/alerts/" },
            {
              label: "Provisioning with OpenTofu",
              link: "/topics/provisioning-with-tofu/",
            },
            {
              label: "Supply-chain protection",
              link: "/topics/supply-chain/",
            },
            {
              label: "Security pipeline",
              link: "/topics/security/",
            },
            { label: "Cookie consent", link: "/topics/cookie-consent/" },
            { label: "Privacy policy template", link: "/topics/privacy/" },
            { label: "Terms of service template", link: "/topics/terms/" },
          ],
        },
        {
          label: "Recipes",
          items: [
            { label: "Add Stripe Checkout", link: "/recipes/add-stripe/" },
            { label: "Add S3-compatible uploads", link: "/recipes/add-s3-uploads/" },
            { label: "Add a background job", link: "/recipes/add-background-job/" },
            { label: "Add a service to Compose", link: "/recipes/add-service-to-compose/" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Environment variables", link: "/reference/env-vars/" },
            { label: "Commands cheatsheet", link: "/reference/commands/" },
            { label: "MCP servers for agents", link: "/reference/mcp-servers/" },
            {
              label: "Scripts & tooling",
              link: "/reference/scripts-tooling/",
            },
            { label: "Cost methodology", link: "/reference/cost-methodology/" },
            { label: "Glossary", link: "/reference/glossary/" },
            { label: "What's new", link: "/changelog/" },
          ],
        },
        {
          label: "Runbooks",
          items: [
            {
              label: "Firewall & TLS",
              link: "/runbooks/firewall-and-tls/",
            },
            { label: "Backups", link: "/runbooks/backups/" },
            {
              label: "Cloudflare Email setup",
              link: "/runbooks/cloudflare-email-setup/",
            },
            { label: "Image updates", link: "/runbooks/image-updates/" },
            {
              label: "Env backup & secrets",
              link: "/runbooks/env-backup-and-secrets/",
            },
            {
              label: "OAuth provider setup",
              link: "/runbooks/oauth-provider-setup/",
            },
            { label: "Codecov setup", link: "/runbooks/codecov-setup/" },
          ],
        },
        { label: "Resources", link: "/resources/" },
      ],
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    build: {
      /*
       * Mermaid ships large vendor chunks (mermaid.core, wardley, cytoscape,
       * katex — each ~250–600 kB). astro-mermaid already code-splits them into
       * their own dynamic chunks that load only on pages with diagrams, so they
       * never touch the initial bundle. Raise the warning ceiling above the
       * largest so the build stops flagging a non-issue we can't shrink without
       * dropping diagram support.
       */
      chunkSizeWarningLimit: 700,
    },
  },
});
