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
}
/** References existing package scripts; parity tests reject drift. No arbitrary shell fragments. */
export const STATIC_CHECKS: readonly ICommandCheck[] = [
  { id: "tooling.quality", app: "root", script: "agent:quality" },
  { id: "api.check", app: "api", script: "check" },
  { id: "ui.check", app: "ui", script: "check" },
  { id: "acl.drift", app: "api", script: "generate:acl-types:check" },
  { id: "api.scripts", app: "api", script: "check:scripts-docs" },
  { id: "ui.scripts", app: "ui", script: "check:scripts-docs" },
  { id: "docs.data", app: "docs", script: "check:docs-data" },
];
export const RELEASE_CHECKS: readonly ICommandCheck[] = [
  { id: "api.coverage", app: "api", script: "test:coverage", lane: "coverage" },
  { id: "api.build", app: "api", script: "build" },
  { id: "ui.build", app: "ui", script: "build", nodeEnv: "production" },
  { id: "ui.bundle", app: "ui", script: "size:check", after: "ui.build" },
  {
    id: "ui.modulepreload",
    app: "ui",
    script: "size:check:modulepreload",
    after: "ui.build",
  },
  { id: "docs.build", app: "docs", script: "build:ci", nodeEnv: "production" },
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
