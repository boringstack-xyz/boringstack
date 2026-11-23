import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { missingVariable, configProblems } from "./compose-policy.utils";

/** Every rule the repo's guardrails script already checks, run as-is. */
const GUARDRAIL_CHECKS = [
  "digest-pins",
  "healthchecks",
  "credential-fallbacks",
  "rooted-caps",
  "no-new-privileges",
  "resource-reservations",
] as const;

/** The stack as production renders it, and as a dev machine runs it. */
const RENDERS = [
  {
    name: "dev (all overlays)",
    files: [
      "docker-compose.yml",
      "docker-compose.development-labels.yml",
      "docker-compose.observability.yml",
      "docker-compose.glitchtip.yml",
      "docker-compose.bullmq.yml",
      "docker-compose.mailpit.yml",
      "docker-compose.site.yml",
    ],
    profiles: ["dev", "observability", "glitchtip-dev", "bullmq", "mailpit"],
  },
  {
    name: "prod (all overlays)",
    files: [
      "docker-compose.yml",
      "docker-compose.production-labels.yml",
      "docker-compose.observability.yml",
      "docker-compose.glitchtip.yml",
      "docker-compose.glitchtip-prod-labels.yml",
      "docker-compose.bullmq.yml",
      "docker-compose.wud.yml",
      "docker-compose.site.yml",
    ],
    profiles: ["prod", "observability", "glitchtip-prod", "bullmq", "wud"],
  },
] as const;

export interface IPolicyRun {
  readonly problems: string[];
  /** Set when a render could not run (for example Docker is down). */
  readonly blocked: string | undefined;
}

/**
 * Renders one configuration as JSON. Variables compose requires and nothing
 * provides are filled with a placeholder, the same way the pre-push gate does:
 * the policy is about how services are set up, not their secrets.
 */
const renderConfig = (
  composeDir: string,
  files: readonly string[],
  profiles: readonly string[],
  envBase: string
): { config?: unknown; error?: string } => {
  const folder = mkdtempSync(join(tmpdir(), "factory-policy-"));
  const envFile = join(folder, "policy.vars");
  const placeholders: string[] = [];

  try {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      writeFileSync(
        envFile,
        `${envBase}\n${placeholders.map((name) => `${name}=placeholder-policy-only`).join("\n")}\n`
      );
      const run = spawnSync(
        "docker",
        [
          "compose",
          "--env-file",
          envFile,
          ...files.flatMap((file) => ["-f", file]),
          ...profiles.flatMap((profile) => ["--profile", profile]),
          "config",
          "--format",
          "json",
        ],
        { cwd: composeDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
      );

      if (run.status === 0) {
        const config: unknown = JSON.parse(run.stdout);

        return { config };
      }

      const stderr = run.stderr;
      const missing = missingVariable(stderr);

      if (missing === undefined || placeholders.includes(missing)) {
        const text = stderr.trim();

        return { error: text === "" ? "docker compose config failed" : text };
      }

      placeholders.push(missing);
    }

    return { error: "too many required variables" };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
};

/**
 * Runs the repo's guardrail script for each rule it already covers. The script
 * renders the stack too, so it gets the same placeholder variables the
 * pre-push gate gives it (COMPOSE_ENV_FILES), passed on the command line so
 * this process's environment is not changed.
 */
const guardrailProblems = (infraDir: string, envFile: string): string[] =>
  GUARDRAIL_CHECKS.flatMap((check) => {
    const run = spawnSync(
      "env",
      [
        `COMPOSE_ENV_FILES=${envFile}`,
        join(infraDir, "scripts", "validate-guardrails.sh"),
        check,
      ],
      { encoding: "utf8", timeout: 600_000 }
    );
    const lines = `${run.stdout}${run.stderr}`
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");

    return run.status === 0
      ? []
      : [`guardrail ${check}: ${lines.at(-1) ?? "failed with no output"}`];
  });

/** The variables pre-push gives the guardrails: the example file plus placeholders. */
const guardrailVariables = (envBase: string, folder: string): string => {
  const file = join(folder, "guardrail-vars");

  writeFileSync(
    file,
    [
      envBase,
      "GLITCHTIP_SECRET_KEY=placeholder-policy-only",
      "GLITCHTIP_PUBLIC_HOST=glitchtip.example.com",
      "GLITCHTIP_BASIC_AUTH_USERS=user:placeholder",
      "GLITCHTIP_SUPERUSER_PASSWORD=placeholder-policy-only",
      "GRAFANA_ADMIN_PASSWORD=placeholder-policy-only",
      "",
    ].join("\n")
  );

  return file;
};

/** The compose policy: every render of the stack, plus the guardrails it reuses. */
export const runComposePolicy = (
  root: string,
  envExample: string
): IPolicyRun => {
  const composeDir = join(root, "infra", "compose", "compose");
  const infraDir = join(root, "infra", "compose");
  const envBase = readFileSync(envExample, "utf8");
  const problems: string[] = [];

  for (const render of RENDERS) {
    const result = renderConfig(
      composeDir,
      render.files,
      render.profiles,
      envBase
    );

    if (result.error !== undefined) {
      return {
        problems,
        blocked: `${render.name} did not render: ${result.error.split("\n").at(-1) ?? ""}`,
      };
    }

    problems.push(
      ...configProblems(result.config).map((line) => `${render.name}: ${line}`)
    );
  }

  const folder = mkdtempSync(join(tmpdir(), "factory-guardrails-"));

  try {
    problems.push(
      ...guardrailProblems(infraDir, guardrailVariables(envBase, folder))
    );
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }

  return { problems, blocked: undefined };
};
