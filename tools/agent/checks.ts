import type { SandboxLaneName } from "./sandbox/lifecycle";

export interface ICommandCheck {
  id: string;
  app: "api" | "ui" | "docs" | "root";
  script: string;
  nodeEnv?: "production";
  /** Stateful scripts run against their own lane database. */
  lane?: SandboxLaneName;
  /** Runs only after the named check has finished (it reads that check's output). */
  after?: string;
  priority?: number;
}
/** Constituent scripts must exactly cover each aggregate gate (checked by contracts.test.ts). */
export const CHECK_GROUPS = [
  {
    id: "tooling.quality",
    app: "root",
    script: "agent:quality",
    parts: ["agent:typecheck", "agent:lint", "agent:format:check"],
  },
  {
    id: "api.check",
    app: "api",
    script: "check",
    parts: ["typecheck", "lint", "lint:meta", "check:lint-meta-docs", "knip"],
  },
  {
    id: "ui.check",
    app: "ui",
    script: "check",
    parts: [
      "lint",
      "lint:meta",
      "check:lint-meta-docs",
      "format:check",
      "typecheck",
      "knip",
    ],
  },
] as const;
/** References existing package scripts; parity tests reject drift. No arbitrary shell fragments. */
export const STATIC_CHECKS: readonly ICommandCheck[] = [
  ...CHECK_GROUPS.flatMap((group) =>
    group.parts.map((script) => ({
      id: `${group.id}.${script}`,
      app: group.app,
      script,
      priority:
        script.includes("typecheck") || script.endsWith("lint") ? 30 : 0,
    }))
  ),
  { id: "acl.drift", app: "api", script: "generate:acl-types:check" },
  { id: "api.scripts", app: "api", script: "check:scripts-docs" },
  { id: "ui.scripts", app: "ui", script: "check:scripts-docs" },
  { id: "docs.data", app: "docs", script: "check:docs-data" },
];
export const RELEASE_CHECKS: readonly ICommandCheck[] = [
  { id: "api.build", app: "api", script: "build" },
  {
    id: "ui.build",
    app: "ui",
    script: "build",
    nodeEnv: "production",
    priority: 40,
  },
  { id: "ui.bundle", app: "ui", script: "size:check", after: "ui.build" },
  {
    id: "ui.modulepreload",
    app: "ui",
    script: "size:check:modulepreload",
    after: "ui.build",
  },
  {
    id: "docs.build",
    app: "docs",
    script: "build:ci",
    nodeEnv: "production",
    priority: 40,
  },
];
export const PROFILES = [
  "openapi",
  "static",
  "feature",
  "security",
  "release-local",
] as const;
export type Profile = (typeof PROFILES)[number];

export function isProfile(value: string): value is Profile {
  const names: readonly string[] = PROFILES;

  return names.includes(value);
}
