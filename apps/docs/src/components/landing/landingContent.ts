export type CodeLine =
  | { kind: "muted"; text: string }
  | { kind: "command"; text: string }
  | { kind: "ok"; text: string }
  | { kind: "spacer" };

export interface CodeTab {
  id: string;
  label: string;
  lines: CodeLine[];
  /** One line under the panel. Per-tab, because a single caption describing
   *  the API -> OpenAPI -> UI flow made no sense beside an agent transcript. */
  caption: string;
}

/*
 * The two strings the hero is built around. `agentPrompt` is what a person
 * pastes into their agent; `installCommand` is what the agent (or a person who
 * would rather not delegate) runs. Both are duplicated in
 * apps/docs/public/agents.md and public/install.sh: check:agent-surface
 * asserts the installer and the manifest agree, and these should be updated
 * alongside them.
 */
export const agentPrompt = "Set up boringstack.xyz for me";

export const installCommand =
  "curl -fsSL https://boringstack.xyz/install.sh | sh -s -- --project acme";

export const codeTabs: CodeTab[] = [
  {
    id: "agent",
    label: "Point an agent at it",
    lines: [
      { kind: "muted", text: "# you, to your coding agent" },
      { kind: "command", text: "Set up boringstack.xyz for me" },
      { kind: "spacer" },
      { kind: "muted", text: "# the agent reads /agents.md and runs" },
      { kind: "command", text: "curl -fsSL https://boringstack.xyz/install.sh | sh -s -- --project acme" },
      { kind: "spacer" },
      { kind: "ok", text: "[1/5] preflight  compose v2, ports free, 12GB" },
      { kind: "ok", text: "[2/5] scaffold   gh repo create (or git clone)" },
      { kind: "ok", text: "[3/5] rename     boringstack -> acme" },
      { kind: "ok", text: "[4/5] boot       ./setup.sh --up" },
      { kind: "ok", text: "[5/5] health     ui 200, api 200" },
      { kind: "spacer" },
      { kind: "muted", text: "# ready -> http://localhost:7331" },
    ],
    caption:
      "Point an agent at the domain and it has everything it needs in one fetch. GitHub auth is optional. Without it the installer clones the public repo, so nothing waits on a browser login.",
  },

  {
    id: "boot",
    label: "Boot locally",
    lines: [
      { kind: "muted", text: "# from the repo root" },
      { kind: "command", text: "./setup.sh --up" },
      { kind: "spacer" },
      { kind: "ok", text: "postgres ready on 5432" },
      { kind: "ok", text: "valkey ready on 6379" },
      { kind: "ok", text: "api-dev migrated and serving /swagger/json" },
      { kind: "ok", text: "ui-dev generated client and started Vite" },
      { kind: "ok", text: "observability + GlitchTip on by default; opt out with WITH_*=0" },
      { kind: "spacer" },
      { kind: "muted", text: "# open http://localhost:7331 and sign in" },
    ],
    caption:
      "One command from a fresh clone to a running stack, migrations included.",
  },
  {
    id: "api",
    label: "Typed API",
    lines: [
      { kind: "muted", text: "# apps/api" },
      { kind: "command", text: "bun run generate:openapi" },
      { kind: "spacer" },
      { kind: "ok", text: "TypeBox routes emitted /openapi.json" },
      { kind: "ok", text: "UI client regenerated from the live schema" },
      { kind: "ok", text: "route contracts fail before drift reaches review" },
      { kind: "spacer" },
      { kind: "muted", text: "# server and client move together" },
    ],
    caption:
      "API -> OpenAPI -> UI. Server and client move together or the build fails.",
  },
  {
    id: "jobs",
    label: "Background jobs",
    lines: [
      { kind: "muted", text: "# apps/api queues" },
      { kind: "command", text: "WITH_BULLMQ=1 ./dev.sh up -d" },
      { kind: "spacer" },
      { kind: "ok", text: "Valkey is shared by cache and queue workers" },
      { kind: "ok", text: "idempotent processors guard retry paths" },
      { kind: "ok", text: "bull-board is available in development only" },
      { kind: "spacer" },
      { kind: "muted", text: "# delayed work stays visible while you build" },
    ],
    caption:
      "Queues and cache share one Valkey, with the job UI available in dev.",
  },
  {
    id: "deploy",
    label: "Deploy path",
    lines: [
      { kind: "muted", text: "# infra-template" },
      { kind: "command", text: "./compose/prod.sh up -d --pull always" },
      { kind: "spacer" },
      { kind: "ok", text: "Traefik routes same-origin API and UI traffic" },
      {
        kind: "ok",
        text: "TLS, backups, secrets, and updates live beside code",
      },
      { kind: "ok", text: "OpenTofu can provision the first VPS when needed" },
      { kind: "spacer" },
      { kind: "muted", text: "# local shape and deploy shape stay related" },
    ],
    caption:
      "The local shape and the deploy shape stay related, with runbooks beside the code.",
  },
];

export const stackLinks = [
  {
    href: "/api/overview/",
    label: "apps/api",
    detail: "Bun / Elysia / Drizzle / auth / billing",
  },
  {
    href: "/ui/overview/",
    label: "apps/ui",
    detail: "React / Vite / OpenAPI client / Playwright",
  },
  {
    href: "/infra/overview/",
    label: "infra-compose",
    detail: "Postgres / Valkey / Traefik / observability",
  },
  {
    href: "/topics/provisioning-with-tofu/",
    label: "infra-tofu",
    detail: "VPS bootstrap / DNS / firewall / first boot",
  },
] as const;

export const docsSteps = [
  {
    href: "/agents.md",
    number: "01",
    title: "Hand your agent one page.",
    detail:
      "/agents.md is the setup command, the health checks, the config manifest, and the invariants it must not break. One fetch, then it can work.",
  },
  {
    href: "/quickstart/",
    number: "02",
    title: "Or run the five phases yourself.",
    detail:
      "install.sh does preflight, scaffold, rename, boot and health check. It never prompts, and --json makes every phase machine-readable.",
  },
  {
    href: "/architecture/lint-as-contract/",
    number: "03",
    title: "Read what the rules enforce.",
    detail:
      "The lint config is the contract, so agent output either matches the architecture or fails the build. This page is why.",
  },
] as const;

export const docsCoverage = [
  "auth",
  "billing",
  "queues",
  "email",
  "tenancy",
  "testing",
  "deploys",
  "architecture rules",
] as const;

export const stackFlow = [
  {
    href: "/api/overview/",
    label: "apps/api",
    title: "apps/api",
    detail:
      "Auth, billing, queues, email, audit, roles, memberships, and Stripe hooks.",
  },
  {
    href: "/ui/overview/",
    label: "apps/ui",
    title: "apps/ui",
    detail:
      "React, Vite, TanStack Query, Playwright, i18n, and generated OpenAPI client.",
  },
  {
    href: "/infra/overview/",
    label: "infra-compose",
    title: "infra-compose",
    detail:
      "Postgres, Valkey, Mailpit, observability, logs, metrics, and overlays.",
  },
  {
    href: "/topics/provisioning-with-tofu/",
    label: "infra-tofu",
    title: "infra-tofu",
    detail:
      "Traefik, TLS, backups, image updates, secrets, firewall rules, and optional OpenTofu.",
  },
] as const;

export const githubOrg = {
  name: "boringstack-xyz",
  url: "https://github.com/boringstack-xyz",
} as const;

export const proofRows = [
  {
    label: "tenant model",
    value:
      "Accounts, memberships, roles, plan features, and active membership checks are part of the data model.",
  },
  {
    label: "COGS posture",
    value:
      "Open-source runtime services come first. Paid providers are integrations, not required foundations.",
  },
  {
    label: "AI review contract",
    value:
      "Architecture lint rules turn intent into concrete failures before human review.",
  },
  {
    label: "real deploy shape",
    value:
      "TLS, firewall, backups, image updates, secrets, and runbooks live beside the code.",
  },
] as const;

/*
 * The answer to the obvious objection: an agent can scaffold something bespoke
 * in minutes, so why start from a template?
 *
 * Because the code is the easy half. Every row here is a mechanical fact in
 * this repo, not a claim: the plugin names, workflow filenames and rule names
 * are real and greppable. Keep it that way: if a row cannot be pointed at, it
 * does not belong here.
 */
export const guardrailRows = [
  {
    bespoke: "Looks right",
    boringstack:
      "18 custom ESLint plugins block the wrong shape at commit time, not at review time.",
  },
  {
    bespoke: "A quiet tenant leak",
    boringstack:
      "A lint rule refuses any query that omits the accountId scope. Isolation is a build error, not a code review.",
  },
  {
    bespoke: "API and UI drift apart",
    boringstack:
      "The API emits OpenAPI; the UI generates its client from it. A contract change is a compile error before it is a bug.",
  },
  {
    bespoke: "Plausible auth",
    boringstack:
      "ACL types are generated from the API\u2019s own constants, and drift fails its own CI job.",
  },
  {
    bespoke: "Unverified webhooks",
    boringstack:
      "Signature verification is required by rule. Forgetting it doesn\u2019t compile.",
  },
  {
    bespoke: "No CI worth the name",
    boringstack:
      "24 pinned workflows, 9 required checks, 56 repo-level rules, and a coverage floor that only ratchets up.",
  },
] as const;
