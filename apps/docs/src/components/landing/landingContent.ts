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

export const stackLayers = [
  {
    name: "Interface",
    path: "apps/ui",
    href: "/ui/overview/",
    symbol: "01",
    title: "Your product starts here.",
    description:
      "A React application with the everyday plumbing already connected to the API. Spend your first day on the feature.",
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
    symbol: "02",
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
    symbol: "03",
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
    symbol: "04",
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
