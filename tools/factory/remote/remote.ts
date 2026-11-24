import { existsSync } from "node:fs";
import { join } from "node:path";

import type { IFactoryContext } from "../context";
import { type ProcessRunner, runProcess } from "../fleet/process";
import { blocked, type ICommandOutcome, ok } from "../result";

/*
 * `bun run factory remote`: how to run agents in the cloud and steer them from
 * a phone, and what this checkout still lacks for each route. Read-only: it
 * lists names with `gh`, and prints commands for a person to run. It never
 * sets a secret or variable, and never starts anything.
 */

export interface IRemoteDeps {
  readonly run: ProcessRunner;
  readonly exists: (path: string) => boolean;
}

export const defaultRemoteDeps = (): IRemoteDeps => ({
  run: runProcess,
  exists: existsSync,
});

export interface IRemoteItem {
  readonly kind: "secret" | "variable";
  readonly name: string;
  /** Whether the name is set on the repository (or on the environment it names). */
  readonly present: boolean;
  /** Variables only, and only the switches that are safe to show. */
  readonly value?: string;
  readonly setIt: string;
  readonly why: string;
}

export interface IRemoteReport {
  readonly tierA: { readonly summary: string };
  readonly tierB: { readonly items: readonly IRemoteItem[] };
  readonly tierC: { readonly blueprint: boolean };
}

/** Variables whose value a person may see in the report. */
const SHOWN_VALUES = new Set(["AGENTS_ENABLED", "DEPS_AUTOFIX_ENABLED"]);

const NAME = /^[A-Z][A-Z0-9_]*$/u;

/**
 * Names from `gh secret list` (NAME, then UPDATED) or `gh variable list`
 * (NAME, VALUE, UPDATED), one row per line, tab-separated when piped.
 */
export const parseGhNames = (
  output: string,
  kind: "secret" | "variable"
): Map<string, string | undefined> => {
  const rows = new Map<string, string | undefined>();

  for (const line of output.split("\n")) {
    const columns = line.split("\t");
    const name = (columns[0] ?? "").trim();

    if (NAME.test(name)) {
      rows.set(
        name,
        kind === "variable" ? (columns[1] ?? "").trim() : undefined
      );
    }
  }

  return rows;
};

const listNames = (
  deps: IRemoteDeps,
  root: string,
  kind: "secret" | "variable"
): Map<string, string | undefined> | string => {
  const args = kind === "secret" ? ["secret", "list"] : ["variable", "list"];
  const result = deps.run("gh", args, { cwd: root });

  if (result.status === 127) {
    return "gh is not installed (https://cli.github.com)";
  }

  if (result.status !== 0) {
    const detail = result.stderr.trim();

    return `gh cannot list ${kind}s: ${detail === "" ? "run gh auth login, then try again" : detail}`;
  }

  return parseGhNames(result.stdout, kind);
};

const tierBItems = (
  secrets: Map<string, string | undefined>,
  variables: Map<string, string | undefined>
): IRemoteItem[] => {
  const secret = (name: string, why: string): IRemoteItem => ({
    kind: "secret",
    name,
    present: secrets.has(name),
    setIt: `gh secret set ${name}`,
    why,
  });

  const variable = (name: string, want: string, why: string): IRemoteItem => {
    const value = variables.get(name);

    return {
      kind: "variable",
      name,
      present: variables.has(name),
      value: SHOWN_VALUES.has(name) ? value : undefined,
      setIt: `gh variable set ${name} --body ${want}`,
      why,
    };
  };

  return [
    secret(
      "CLAUDE_CODE_OAUTH_TOKEN",
      "lets the Claude Code Action run in the agent lanes; create it with `claude setup-token` on your laptop and paste it when asked (it is not stored in this repository)"
    ),
    variable(
      "AGENTS_ENABLED",
      "1",
      "the kill switch for every agent workflow; any value other than 1 keeps the lanes off"
    ),
  ];
};

export const buildRemoteReport = (
  context: IFactoryContext,
  deps: IRemoteDeps
): IRemoteReport | string => {
  const secrets = listNames(deps, context.root, "secret");

  if (typeof secrets === "string") {
    return secrets;
  }

  const variables = listNames(deps, context.root, "variable");

  if (typeof variables === "string") {
    return variables;
  }

  return {
    tierA: {
      summary:
        'Cloud sessions run on Anthropic\'s infrastructure and keep working when your laptop is closed. Start one at claude.ai/code or in the Claude app (Code tab), or run `claude --cloud "<task>"` in this checkout. Needs a Pro, Max, Ultra, Team or Enterprise login and GitHub access to this repository. Nothing to set here.',
    },
    tierB: { items: tierBItems(secrets, variables) },
    tierC: {
      blueprint: deps.exists(join(context.root, "infra/agent-host/main.tf")),
    },
  };
};

const mark = (item: IRemoteItem): string => {
  if (!item.present) {
    return "missing";
  }

  return item.value === undefined ? "set" : `set to ${item.value}`;
};

/** The human summary. Plain text, no secret values, one next step per gap. */
export const renderRemote = (report: IRemoteReport): string => {
  const lines: string[] = [
    "Remote agents for this checkout. Read docs/operations/remote-agents.md first.",
    "",
    "Tier a, cloud sessions (claude.ai/code, the Claude app, claude --cloud):",
    `  ${report.tierA.summary}`,
    "",
    "Tier b, GitHub Actions agent lanes (started by a person: the triage command, the Actions tab, or a PR event; this repo has no @claude mention workflow):",
  ];

  for (const item of report.tierB.items) {
    lines.push(`  ${item.name}: ${mark(item)}`);

    if (!item.present) {
      lines.push(`    ${item.why}`, `    next: ${item.setIt}`);
    }
  }

  const missing = report.tierB.items.filter((item) => !item.present);

  lines.push(
    missing.length === 0
      ? "  The lanes are configured. They still need AGENTS_ENABLED=1 to run."
      : "  Lanes stay off until every item above is set and AGENTS_ENABLED is 1."
  );
  lines.push(
    "",
    "Tier c, always-on agent host (off by default):",
    report.tierC.blueprint
      ? "  infra/agent-host is in this checkout. Copy infra/agent-host/terraform.tfvars.example to terraform.tfvars, set TF_VAR_hetzner_api_token, then a person reviews the plan and applies it. Agents do not apply."
      : "  infra/agent-host is missing from this checkout; update the repository first."
  );

  return lines.join("\n");
};

export const remoteCommand = (
  context: IFactoryContext,
  deps: IRemoteDeps = defaultRemoteDeps()
): ICommandOutcome => {
  const report = buildRemoteReport(context, deps);

  return typeof report === "string"
    ? blocked(
        `${report}. Remote options are in docs/operations/remote-agents.md; this check needs gh.`,
        { reason: "gh_unavailable" }
      )
    : ok(renderRemote(report), report);
};
