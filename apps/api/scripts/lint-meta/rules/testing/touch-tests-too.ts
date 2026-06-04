import { execSync } from "node:child_process";
import { basename } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

/*
 * Logic/route suffixes that require a test. Kept a superset of
 * logic-files-require-test-sibling's SUFFIX_REQUIRES_TEST
 * (service|utils|jobs|check|channel|helpers) plus `routes` (guarded by
 * routes-require-test-sibling). check/channel/helpers were missing here, so
 * editing one without touching its test slipped past the opt-in touched-tests
 * reminder even though the test sibling itself is mandatory.
 */
const TOUCHED_REQUIRES_TEST_PATTERN =
  /^src\/.+\.(service|routes|utils|jobs|check|channel|helpers)\.ts$/u;

export function checkTouchedTests(baseRef: string, root: string): IViolation[] {
  const violations: IViolation[] = [];
  let changedFiles: readonly string[];

  try {
    const out = execSync(`git diff --name-only --diff-filter=ACMR ${baseRef}`, {
      cwd: root,
      encoding: "utf8",
    });

    changedFiles = out
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return violations;
  }

  const changedSet = new Set(changedFiles);
  const subjectFiles = changedFiles.filter((changedFile) =>
    TOUCHED_REQUIRES_TEST_PATTERN.test(changedFile)
  );

  for (const subject of subjectFiles) {
    if (subjectHasMatchingTest(subject, changedSet)) {
      continue;
    }

    violations.push({
      file: subject,
      rule: "touch-tests-too",
      message: `\`${subject}\` was modified but no matching \`tests/**/${basename(
        subject,
        ".ts"
      )}.test.ts\` change was found in this diff against \`${baseRef}\`. Update the test alongside the code, or remove the corresponding test stub.`,
    });
  }

  return violations;
}

function subjectHasMatchingTest(
  subject: string,
  changedSet: Set<string>
): boolean {
  const baseName = basename(subject, ".ts");
  const expectedTestSuffix = `${baseName}.test.ts`;

  for (const changed of changedSet) {
    if (changed.startsWith("tests/") && changed.endsWith(expectedTestSuffix)) {
      return true;
    }
  }

  return false;
}

/**
 * Opt-in via LINT_META_TOUCHED_BASE=<git-ref>: flags logic/route files
 * changed without a matching test change in the same diff.
 */
export const touchTestsTooRule: IMetaRule = {
  id: "touch-tests-too",
  category: "testing",
  description:
    "Modified logic/route files must include a matching test change (opt-in via LINT_META_TOUCHED_BASE).",
  run({ root }) {
    const baseRef = process.env.LINT_META_TOUCHED_BASE;

    if (baseRef === undefined || baseRef === "") {
      return [];
    }

    return checkTouchedTests(baseRef, root);
  },
};
