import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

const RULE_ID = "github-actions-pip-install-pinned";

const PIP_INSTALL_REGEX = /\bpip3?\s+install\s+(?<args>[^#]*)/u;

/*
 * A `pip install <tool>` step with no `==` pin runs whatever PyPI
 * published last night: a linter's ruleset (yamllint, semgrep, …) can
 * change between CI runs with zero repo diff, flipping the gate without
 * a commit to blame. Every other version in this repo is exact-pinned
 * (deps, actions by SHA, scanner versions) — job-time pip installs get
 * the same bar. Flags, requirement files, and local paths/URLs are out
 * of scope; bare package names must carry `==<version>` (a `${VAR}`
 * interpolation counts — the pin then lives in an env var the local
 * pre-push gate can read, like GITLEAKS_VERSION).
 */
export function checkWorkflowPipInstallPinned(file: string): IViolation[] {
  const violations: IViolation[] = [];
  const lines = readFileSync(file, "utf8").split("\n");

  for (const line of lines) {
    const args = PIP_INSTALL_REGEX.exec(line)?.groups?.args;

    if (args === undefined) {
      continue;
    }

    const unpinned = args
      .trim()
      .split(/\s+/u)
      .filter(
        (token) =>
          token !== "" &&
          !token.startsWith("-") &&
          !token.includes("==") &&
          !token.includes("/") &&
          !token.endsWith(".txt")
      );

    for (const pkg of unpinned) {
      violations.push({
        file,
        rule: RULE_ID,
        message: `pip install '${pkg}' has no version pin — CI silently tracks the latest PyPI release and its ruleset can change between runs with no repo diff. Pin it (e.g. ${pkg}==X.Y.Z, ideally via an env var the local pre-push gate can read).`,
      });
    }
  }

  return violations;
}

/**
 * Job-time `pip install` without `==` tracks latest-from-PyPI, so a tool's
 * behavior can flip between CI runs with no commit; pin like everything else.
 */
export const githubActionsPipInstallPinnedRule: IMetaRule = {
  id: RULE_ID,
  category: "ci",
  description:
    "Workflow pip install steps must pin package versions with == so CI tools cannot drift with PyPI releases.",
  run({ workflowFiles }) {
    return workflowFiles.flatMap(checkWorkflowPipInstallPinned);
  },
};
