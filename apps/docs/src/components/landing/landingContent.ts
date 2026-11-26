/** Keep the public setup instructions consistent with /agents.md. */
export const agentPrompt = "Set up boringstack.xyz for me";
export const installCommand =
  "curl -fsSL https://boringstack.xyz/install.sh | sh -s -- --project acme";
export const setupNote =
  "GitHub auth is optional. Without it, the installer clones the public repository. Five phases, no prompts.";

export const githubOrg = {
  name: "boringstack-xyz",
  url: "https://github.com/boringstack-xyz/boringstack",
} as const;

/* What runs in the factory and the automation around it, where, its state in a
   fresh clone, and what stays with a person. Each state is set in the repo's
   workflows or the factory README; keep this in step with them. */
export const factoryRows = [
  {
    what: "Issue workspaces",
    where:
      "Your machine. One worktree and one stack per issue, with its own ports and database.",
    state:
      "On. Commands: `factory workspace`, `up`, `verify`, `handover`, `pr`.",
    person: "Which issues to build, and whether to ship each one.",
  },
  {
    what: "Verify gate and Stop hook",
    where:
      "Claude Code and Codex hooks, in `.claude/settings.json` and `.codex/hooks.json`.",
    state:
      "On in this checkout. A session cannot finish until its changes pass.",
    person:
      "Whatever only a person can provide. The session records it in `BLOCKED`.",
  },
  {
    what: "Agent lanes: triage, review, revise, merge, digest",
    where:
      "GitHub Actions. An agent PR gets an independent review that names its risk: low, medium or high.",
    state:
      "Off until `AGENTS_ENABLED=1` and `CLAUDE_CODE_OAUTH_TOKEN` are set.",
    person:
      "Which findings go to triage, and every high-risk PR. Agents merge low and medium.",
  },
  {
    what: "Dependency autopilot",
    where: "Dependabot, daily. Auto-merge and a steward run on GitHub.",
    state:
      "Auto-merge is on. The dependency agent waits for `DEPS_AUTOFIX_ENABLED`.",
    person:
      "Only the updates the agent could not fix, labelled `deps-needs-person`.",
  },
  {
    what: "Production robot",
    where:
      "GitHub Actions. A new user signs up, walks the product and is removed.",
    state:
      "Off until `ROBOT_APP_URL` names the deployed app. Runs after each release and every six hours.",
    person: "The failure issue that opens when the robot fails.",
  },
  {
    what: "Remote agents",
    where:
      "Cloud sessions at claude.ai/code, steered from a phone. A self-hosted host blueprint in `infra/agent-host`.",
    state:
      "Cloud sessions need a Claude plan login. The host blueprint is validated and not applied.",
    person:
      "Starting and steering the session, and applying any infrastructure.",
  },
] as const;

export const stackLayers = [
  {
    name: "Public site",
    path: "apps/site",
    href: "/site/overview/",
    symbol: "01",
    title: "Your marketing site, on your domain.",
    description:
      "An SEO-ready marketing site and blog on the apex domain. Static pages, no cookies, no API calls.",
    technology: "Astro / static HTML / nginx",
    connection: ["Static build", "nginx", "Your domain"],
    features: [
      ["Pages & blog", "Landing, pricing, and Markdown blog posts."],
      [
        "SEO built in",
        "Canonical URLs, sitemap, JSON-LD, and social cards generated at build.",
      ],
      [
        "Consent-gated analytics",
        "Off by default. Loads only after the visitor opts in.",
      ],
      [
        "Hardened nginx",
        "CSP, security headers, and a read-only root filesystem.",
      ],
    ],
  },
  {
    name: "Interface",
    path: "apps/ui",
    href: "/ui/overview/",
    symbol: "02",
    title: "Your product starts here.",
    description:
      "A React application on app.<your domain>, with the everyday plumbing already connected to the API. Spend your first day on the feature.",
    technology: "React / Vite / TanStack Query",
    connection: ["API schema", "OpenAPI client", "Interface"],
    features: [
      [
        "Authentication screens",
        "Sign in, invitations, account switching, and settings.",
      ],
      [
        "Generated API client",
        "Typed requests that follow the server contract.",
      ],
      [
        "Product foundations",
        "Notifications, billing views, and internationalization.",
      ],
      ["Browser testing", "Playwright checks alongside the application."],
    ],
  },
  {
    name: "Application",
    path: "apps/api",
    href: "/api/overview/",
    symbol: "03",
    title: "The difficult parts, wired in.",
    description:
      "Tenant-aware data, auth, and billing belong in the first clone. The API brings them together with rules that check the boundaries.",
    technology: "Bun / Elysia / Drizzle",
    connection: ["Request", "Auth + tenant scope", "Data / jobs"],
    features: [
      [
        "Accounts & permissions",
        "Memberships, roles, and account-scoped queries.",
      ],
      [
        "Billing & webhooks",
        "Stripe hooks, signature verification, and plan features.",
      ],
      ["Background work", "BullMQ workers and retry-aware job handling."],
      ["Audit & email", "Audit trails and transactional email integrations."],
    ],
  },
  {
    name: "Services",
    path: "infra/compose",
    href: "/infra/overview/",
    symbol: "04",
    title: "A home for your runtime.",
    description:
      "Compose brings the application and its supporting services together. Local development and deployment share a recognizable shape.",
    technology: "Postgres / Valkey / Traefik",
    connection: ["Compose", "Services", "Health checks"],
    features: [
      [
        "Data & queues",
        "Postgres for persistent data. Valkey for cache and jobs.",
      ],
      ["Routing & TLS", "Traefik and deployment overlays beside the code."],
      ["Observability", "Logs, metrics, tracing, and error tracking."],
      [
        "Development utilities",
        "Mailpit and local tools for seeing what happens.",
      ],
    ],
  },
  {
    name: "Infrastructure",
    path: "infra/bootstrap",
    href: "/topics/provisioning-with-tofu/",
    symbol: "05",
    title: "Your server. Your rules.",
    description:
      "Optional OpenTofu bootstraps the host. Deployment scripts and runbooks make the operational work part of the repository.",
    technology: "OpenTofu / cloud-init / VPS",
    connection: ["Provision", "Bootstrap host", "Deploy stack"],
    features: [
      ["Host provisioning", "Optional infrastructure as code for your VPS."],
      ["First-boot setup", "Host configuration recorded alongside the stack."],
      [
        "Operational runbooks",
        "Documented paths for backups, TLS, and updates.",
      ],
      ["Self-hosted runtime", "Run on infrastructure you control."],
    ],
  },
] as const;
