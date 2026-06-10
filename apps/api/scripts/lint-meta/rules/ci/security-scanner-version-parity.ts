import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

/*
 * Secret/SAST scanners encode their ruleset in their version: two workflows
 * running different gitleaks or semgrep versions scan with different rules,
 * so one can pass code the other would flag. The pinned version is duplicated
 * across every `*-security-secrets`/`-sast` workflow with nothing forcing the
 * copies to agree — a bump to one drifts silently from the rest. This rule
 * requires a single gitleaks version and a single semgrep image pin across
 * all workflows, AND that scripts/ci/pre-push-security.sh carries a runtime
 * version-parity check (`EXPECTED_<TOOL>_VERSION=` read from the workflow +
 * `LOCAL_<TOOL>_VERSION=` from the installed binary) for every scanner the
 * workflows pin — a scanner checked in CI but not in the pre-push gate lets
 * a local/CI ruleset gap pass the push that CI then fails.
 */

const GITLEAKS_VERSION_REGEX =
  /^\s*GITLEAKS_VERSION:\s*["']?(\d+\.\d+\.\d+)["']?\s*(?:#.*)?$/u;
const SEMGREP_IMAGE_REGEX =
  /semgrep\/semgrep:(\d+\.\d+\.\d+@sha256:[a-f0-9]+)/u;

const RULE_ID = "security-scanner-version-parity";

function addRef(
  byValue: Map<string, string[]>,
  value: string,
  file: string
): void {
  const existing = byValue.get(value);

  if (existing === undefined) {
    byValue.set(value, [file]);

    return;
  }

  existing.push(file);
}

function parityViolations(
  tool: string,
  byValue: Map<string, string[]>
): IViolation[] {
  if (byValue.size <= 1) {
    return [];
  }

  const values = [...byValue.keys()].sort();
  const expected = values[0];

  if (expected === undefined) {
    return [];
  }

  const out: IViolation[] = [];

  for (const [value, files] of byValue) {
    if (value === expected) {
      continue;
    }

    for (const file of files) {
      out.push({
        file,
        rule: RULE_ID,
        message: `${tool} pinned to ${value} here but ${expected} elsewhere — single-source the ${tool} version across all security workflows so every scan runs the same ruleset.`,
      });
    }
  }

  return out;
}

const PRE_PUSH_SECURITY_SCRIPT = join("scripts", "ci", "pre-push-security.sh");

/*
 * The pre-push script lives at the repository root, which is the app root in
 * a standalone checkout but an ancestor in a monorepo. Walk up to wherever it
 * actually is; a repo without it has deliberately removed the pre-push gate
 * and opts out of this check (same posture as pre-push-ci-parity's manifest).
 */
function resolvePrePushSecurityScript(root: string): string | null {
  let current = root;

  for (;;) {
    const candidate = join(current, PRE_PUSH_SECURITY_SCRIPT);

    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function checkPrePushScannerParity(
  root: string,
  workflowFiles: readonly string[]
): IViolation[] {
  const pinnedTools = new Set<string>();

  for (const file of workflowFiles) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (GITLEAKS_VERSION_REGEX.test(line)) {
        pinnedTools.add("GITLEAKS");
      }

      if (SEMGREP_IMAGE_REGEX.test(line)) {
        pinnedTools.add("SEMGREP");
      }
    }
  }

  if (pinnedTools.size === 0) {
    return [];
  }

  const scriptPath = resolvePrePushSecurityScript(root);

  if (scriptPath === null) {
    return [];
  }

  const script = readFileSync(scriptPath, "utf8");
  const out: IViolation[] = [];

  for (const tool of [...pinnedTools].sort()) {
    const expectedVar = `EXPECTED_${tool}_VERSION=`;
    const localVar = `LOCAL_${tool}_VERSION=`;

    if (!script.includes(expectedVar) || !script.includes(localVar)) {
      out.push({
        file: scriptPath,
        rule: RULE_ID,
        message: `CI pins a ${tool.toLowerCase()} version but the pre-push gate never compares the local ${tool.toLowerCase()} version against it — add \`${expectedVar}\` (read from the workflow) and \`${localVar}\` (from the installed binary) with a drift warning, mirroring the existing gitleaks parity check.`,
      });
    }
  }

  return out;
}

export function checkSecurityScannerVersionParity(
  files: readonly string[]
): IViolation[] {
  const gitleaks = new Map<string, string[]>();
  const semgrep = new Map<string, string[]>();

  for (const file of files) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const gitleaksMatch = GITLEAKS_VERSION_REGEX.exec(line);

      if (gitleaksMatch?.[1] !== undefined) {
        addRef(gitleaks, gitleaksMatch[1], file);
      }

      const semgrepMatch = SEMGREP_IMAGE_REGEX.exec(line);

      if (semgrepMatch?.[1] !== undefined) {
        addRef(semgrep, semgrepMatch[1], file);
      }
    }
  }

  return [
    ...parityViolations("gitleaks", gitleaks),
    ...parityViolations("semgrep", semgrep),
  ];
}

/**
 * A scanner version bumped in one workflow but not its siblings silently runs
 * divergent rulesets; pin every gitleaks/semgrep reference to one version,
 * and the pre-push gate must version-check every scanner CI pins.
 */
export const securityScannerVersionParityRule: IMetaRule = {
  id: RULE_ID,
  category: "ci",
  description:
    "All security workflows must pin a single gitleaks version and a single semgrep image, and scripts/ci/pre-push-security.sh must carry a local-vs-CI version-parity check for every scanner the workflows pin.",
  run({ root, workflowFiles }) {
    return [
      ...checkSecurityScannerVersionParity(workflowFiles),
      ...checkPrePushScannerParity(root, workflowFiles),
    ];
  },
};
