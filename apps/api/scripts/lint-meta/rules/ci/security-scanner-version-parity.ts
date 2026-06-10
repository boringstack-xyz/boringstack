import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

/*
 * Secret/SAST scanners encode their ruleset in their version: two workflows
 * running different gitleaks or semgrep versions scan with different rules,
 * so one can pass code the other would flag. The pinned version is duplicated
 * across every `*-security-secrets`/`-sast` workflow with nothing forcing the
 * copies to agree — a bump to one drifts silently from the rest. This rule
 * requires a single gitleaks version and a single semgrep image pin across
 * all workflows. (scripts/ci/pre-push-security.sh reads its gitleaks version
 * from the workflow at runtime, so it is single-sourced by construction.)
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
 * divergent rulesets; pin every gitleaks/semgrep reference to one version.
 */
export const securityScannerVersionParityRule: IMetaRule = {
  id: RULE_ID,
  category: "ci",
  description:
    "All security workflows must pin a single gitleaks version and a single semgrep image so every scan runs the same ruleset.",
  run({ workflowFiles }) {
    return checkSecurityScannerVersionParity(workflowFiles);
  },
};
