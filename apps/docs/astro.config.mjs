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
    // emitting <table>/<del> for pipe tables and strikethrough: every table
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
          /*
           * Diagram palette, kept in step with the OKLCH tokens in
           * tailwind.css. Mermaid's theme is build-time JavaScript and cannot
           * read CSS variables, so these are the hex equivalents:
           *   primary  cyan    oklch(0.78 0.14 195) -> #00d2d3
           *   accent   violet  oklch(0.62 0.18 300) -> #9867e1
           *   warning  amber   oklch(0.78 0.16 85)  -> #e6ad00
           *   fg               oklch(0.96 0.01 260) -> #eef2f9
           *   card             oklch(0.21 0.03 265) -> #111826
           *   border           oklch(0.32 0.03 265) -> #2b3342
           * Update both together, or diagrams drift back to a different accent
           * than the rest of the site.
           */

          // Surfaces: Starlight owns the page background.
          background: "transparent",
          mainBkg: "rgba(0, 210, 211, 0.12)",
          secondBkg: "rgba(152, 103, 225, 0.12)",
          tertiaryColor: "rgba(230, 173, 0, 0.10)",
          clusterBkg: "rgba(0, 210, 211, 0.04)",
          clusterBorder: "rgba(0, 210, 211, 0.38)",

          // Primary palette: cyan, the BoringStack accent.
          primaryColor: "rgba(0, 210, 211, 0.14)",
          primaryBorderColor: "#00d2d3",
          primaryTextColor: "#eef2f9",

          // Secondary palette: violet for alternate nodes.
          secondaryColor: "rgba(152, 103, 225, 0.14)",
          secondaryBorderColor: "#9867e1",
          secondaryTextColor: "#eef2f9",

          // Tertiary palette: amber.
          tertiaryBorderColor: "#e6ad00",
          tertiaryTextColor: "#eef2f9",

          // Edges / lines.
          lineColor: "#5f93a8",
          arrowheadColor: "#00d2d3",

          // Text & default node.
          textColor: "#eef2f9",
          nodeBorder: "#2b3342",
          nodeTextColor: "#eef2f9",
          titleColor: "#eef2f9",

          // Edge label chips: mermaid paints a `.labelBkg` div per edge even when
          // there's no label. We restore the colored backing so real labels cover
          // the edge line behind their text, then strip empty edge labels via JS
          // (see the wireMermaidCleanup head script).
          edgeLabelBackground: "rgba(9, 13, 22, 0.94)",
          labelBackground: "rgba(9, 13, 22, 0.94)",
          labelTextColor: "#9199a5",
          labelBoxBorderColor: "transparent",

          // Notes (sequence / generic).
          noteBkgColor: "rgba(0, 210, 211, 0.10)",
          noteTextColor: "#eef2f9",
          noteBorderColor: "#00d2d3",

          // Sequence diagram surfaces.
          actorBkg: "rgba(0, 210, 211, 0.12)",
          actorBorder: "#00d2d3",
          actorTextColor: "#eef2f9",
          actorLineColor: "rgba(0, 210, 211, 0.34)",
          signalColor: "#5f93a8",
          signalTextColor: "#eef2f9",
          loopTextColor: "#9199a5",
          activationBkgColor: "rgba(0, 210, 211, 0.18)",
          activationBorderColor: "#00d2d3",
          sequenceNumberColor: "#03060d",

          // Typography: the mono display face carries diagram labels too, so a
          // node reads like the filename it usually names.
          fontFamily:
            "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
          fontSize: "13px",
        },
      },
    }),
    starlight({
      title: "BoringStack",
      description:
        "The production-grade SaaS starter, built to be set up by an agent. Auth, billing, queues, email and observability already wired, with the architecture enforced by lint and CI. MIT, open source.",
      favicon: "/favicon.svg",
      /*
       * Shared tokens and accessible component styles load first. The base
       * skin maps them to Starlight; paper.css supplies light-only art direction.
       */
      customCss: [
        "./src/styles/tailwind.css",
        "./src/styles/custom.css",
        "./src/styles/redesign.css",
        "./src/styles/paper.css",
      ],
      plugins: [
        /*
         * Agent-facing documentation sets. An agent pointed at this domain
         * reads llms.txt first, so the description below has to carry the
         * install command outright, not a link to it.
         *
         * `rawContent: true` has to stay on. With it off the
         * plugin renders each page through Astro, and index.mdx mounts
         * `<LandingPage client:load />`, a React component the plugin's
         * render context has no renderer for, so the build dies with
         * "No valid renderer was found for the .tsx file extension".
         *
         * The cost of keeping it on is that the MDX pipeline is skipped
         * entirely: every `import ... from "..."` line and every `<Aside>` /
         * `<DocCallout>` tag lands verbatim in the output (46 import lines in
         * llms-full.txt), and the plugin's own `minify` option is inert,
         * because it operates on rendered HTML that never gets produced.
         * That is why llms-small.txt used to come out 412,756 bytes against
         * llms-full.txt's 414,104, a 0.3% saving on the tier that is
         * supposed to be the cheap one.
         *
         * So both are fixed downstream instead: `scripts/sanitize-llms.mjs`
         * strips the MDX residue from all three files after the build, and the
         * `exclude` list below does the real curation work for the small tier.
         *
         * Note `exclude` applies to llms-small.txt ONLY, not llms-full.txt;
         * that asymmetry is upstream behaviour, not a mistake here. The small
         * tier is a deliberate curation: quickstart, architecture and the
         * rules an agent must not break. Runbooks and per-topic detail
         * stay in llms-full.txt where an agent can go looking on purpose.
         *
         * check:agent-surface asserts the size gap and the absence of MDX
         * leakage on every build, so none of this can regress silently.
         */
        starlightLlmsTxt({
          projectName: "BoringStack",
          description:
            "A production-grade full-stack template: Bun + Elysia API, React + Vite SPA, Postgres, Valkey, Docker Compose, OpenTofu. Built to be set up by an agent. Run `curl -fsSL https://boringstack.xyz/install.sh | sh -s -- --project <name>`. The architecture is enforced rather than documented: 18 custom ESLint plugins, 56 repo-level lint rules, ACL and OpenAPI drift gates, and a multi-tenant scoping rule that refuses an unscoped query. Wrong-shaped code fails the build instead of shipping. MIT.",
          details: `Start at https://boringstack.xyz/agents.md. It has the setup command, the health checks, and the invariants an agent must not break, on one page.

The full config surface is machine-readable at https://boringstack.xyz/scaffold-manifest.json: every field with its kind, per-STACK defaults, the services each toggle spawns, and the secrets each one requires. Read it instead of guessing at env vars.

\`bun run check\` is the oracle. If anything in these docs disagrees with what it reports, the lint config wins.`,
          optionalLinks: [
            {
              label: "Agent guide",
              url: "https://boringstack.xyz/agents.md",
              description:
                "setup command, health checks and the invariants, on one page",
            },
            {
              label: "Installer",
              url: "https://boringstack.xyz/install.sh",
              description:
                "preflight, scaffold, rename, boot, health check; never prompts, --json for machine-readable progress",
            },
            {
              label: "Scaffold manifest",
              url: "https://boringstack.xyz/scaffold-manifest.json",
              description:
                "machine-readable config surface: toggles, defaults, spawned services, required secrets",
            },
          ],
          rawContent: true,
          // Ordering matters more for agents than for humans: a reader with a
          // context budget takes the first pages and stops. Collection order
          // put "ACL & feature resolution" first and Quickstart 40% deep.
          promote: [
            "index*",
            "quickstart*",
            "before-you-build*",
            "architecture/why-boringstack*",
            "architecture/stack*",
            "architecture/lint-as-contract*",
            "reference/commands*",
          ],
          // Reference material an agent should reach for deliberately, not
          // read on the way in.
          demote: [
            "runbooks/**",
            "reference/glossary*",
            "reference/cost-methodology*",
            "topics/privacy*",
            "topics/terms*",
            "topics/cookie-consent*",
            "changelog*",
          ],
          // llms-small.txt is the cheap tier: keep it to setup, architecture
          // and the rules. Everything dropped here is still in llms-full.txt.
          // llms-small.txt is the cheap tier: 67 KB against llms-full.txt's
          // 410 KB. Keep it to what an agent needs to set the stack up and then
          // write its first correct change: quickstart, the architecture
          // rationale, and the rules that fail the build.
          //
          // Everything excluded here is still in llms-full.txt. Subsystem deep
          // dives (api/, ui/, infra/), operational runbooks and the per-topic
          // guides are things an agent should fetch on purpose once it knows
          // which one it needs, not read on the way in.
          exclude: [
            "404",
            "api/**",
            "ui/**",
            "infra/**",
            "topics/**",
            "runbooks/**",
            "recipes/**",
            "architecture/decisions",
            "architecture/lint-meta",
            "architecture/csrf-stance",
            "architecture/background-work",
            "reference/cost-methodology",
            "reference/glossary",
            "reference/scripts-tooling",
            "reference/env-vars",
            "changelog",
            "resources",
          ],
          // No `minify` block: it only affects llms-small.txt and only works
          // on rendered HTML, which `rawContent` skips. Curation happens via
          // `exclude` above and sanitize-llms.mjs after the build.
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
        {
          tag: "link",
          attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" },
        },
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.gstatic.com",
            crossorigin: true,
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;500;600;700&display=swap",
          },
        },
        /*
         * Open Graph + Twitter card meta. Starlight injects og:title and
         * og:description from frontmatter automatically, but it does NOT
         * inject og:image: without these tags every LinkedIn / Twitter /
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
              "BoringStack: point your agent at this stack. A production-grade SaaS starter with auth, billing, queues, email and observability already wired. MIT, open source.",
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
              "BoringStack: point your agent at this stack. A production-grade SaaS starter with auth, billing, queues, email and observability already wired. MIT, open source.",
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
            // /agents.md is a static file in public/, not a content-collection
            // route, so Starlight cannot infer it. `attrs` marks it as a plain
            // document rather than a docs page.
            {
              label: "For agents: /agents.md",
              link: "/agents.md",
              attrs: { target: "_blank", rel: "noopener" },
            },
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
            { label: "Verified workflow", link: "/skills/verified-workflow/" },
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
            {
              label: "Repository layout",
              link: "/architecture/monorepo-layout/",
            },
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
            { label: "Kubernetes (k3s)", link: "/infra/kubernetes/" },
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
              label: "Provisioning with k3s (GitOps)",
              link: "/topics/provisioning-with-k3s/",
            },
            {
              label: "Supply-chain protection",
              link: "/topics/supply-chain/",
            },
            {
              label: "Security pipeline",
              link: "/topics/security/",
            },
            { label: "Security specification", link: "/topics/security-spec/" },
            { label: "Cookie consent", link: "/topics/cookie-consent/" },
            { label: "Privacy policy template", link: "/topics/privacy/" },
            { label: "Terms of service template", link: "/topics/terms/" },
          ],
        },
        {
          label: "Recipes",
          items: [
            {
              label: "Add an account resource",
              link: "/recipes/add-account-resource/",
            },
            { label: "Add Stripe Checkout", link: "/recipes/add-stripe/" },
            {
              label: "Add S3-compatible uploads",
              link: "/recipes/add-s3-uploads/",
            },
            {
              label: "Add a background job",
              link: "/recipes/add-background-job/",
            },
            {
              label: "Add a service to Compose",
              link: "/recipes/add-service-to-compose/",
            },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Environment variables", link: "/reference/env-vars/" },
            { label: "Commands cheatsheet", link: "/reference/commands/" },
            { label: "Agent evaluation", link: "/reference/agent-evaluation/" },
            {
              label: "MCP servers for agents",
              link: "/reference/mcp-servers/",
            },
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
            { label: "Security upgrade", link: "/runbooks/security-upgrade/" },
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
            {
              label: "ArgoCD image updater (k3s)",
              link: "/runbooks/argocd-image-updater/",
            },
            {
              label: "Secrets backends (k3s)",
              link: "/runbooks/vault-secrets-operator/",
            },
            {
              label: "Postgres backups (CNPG)",
              link: "/runbooks/cnpg-backups/",
            },
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
       * katex, each ~250–600 kB). astro-mermaid already code-splits them into
       * their own dynamic chunks that load only on pages with diagrams, so they
       * never touch the initial bundle. Raise the warning ceiling above the
       * largest so the build stops flagging a non-issue we can't shrink without
       * dropping diagram support.
       */
      chunkSizeWarningLimit: 700,
    },
  },
});
