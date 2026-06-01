import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SOURCE_DIRS, collectSourceFiles } from "../../context";
import type { IMetaRule, IViolation } from "../../types";

/*
 * Identical to the API's `skipped-tests-need-tracking` rule — keeping
 * the two apps in lockstep so a skipped test in either app surfaces as
 * tracked debt with an owner.
 */
const SKIP_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\b(?:it|test|describe)\.skip\s*\(/u, label: ".skip(" },
  { pattern: /\b(?:it|test|describe)\.only\s*\(/u, label: ".only(" },
  { pattern: /\b(?:it|test|describe)\.fixme\s*\(/u, label: ".fixme(" },
  { pattern: /\bxit\s*\(/u, label: "xit(" },
  { pattern: /\bxdescribe\s*\(/u, label: "xdescribe(" },
  { pattern: /\bxtest\s*\(/u, label: "xtest(" }
];

const TRACKING_PATTERNS: readonly RegExp[] = [
  /https?:\/\/\S+/u,
  /TODO\([^\s)]+\)/u
];

const TEST_FILE_SUFFIX = /\.test\.tsx?$|\.spec\.tsx?$/u;

const TRACKING_LOOKBACK = 30;

function hasTrackingComment(commentText: string): boolean {
  return TRACKING_PATTERNS.some((pattern) => pattern.test(commentText));
}

function extractContext(lines: readonly string[], index: number): string {
  const start = Math.max(0, index - TRACKING_LOOKBACK);

  return lines.slice(start, index + 1).join("\n");
}

export function checkSkippedTestsHaveTracking(root: string): IViolation[] {
  const violations: IViolation[] = [];

  /*
   * Scan only the app's first-party tree (src + tests + e2e). Without
   * this scope the recursive walk descends into `node_modules` and
   * flags intentional fixture skips in vendored packages.
   */
  const files = SOURCE_DIRS.flatMap((dir) =>
    collectSourceFiles(join(root, dir))
  );

  for (const file of files) {
    if (!TEST_FILE_SUFFIX.test(file)) {
      continue;
    }

    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";

      for (const { pattern, label } of SKIP_PATTERNS) {
        if (!pattern.test(line)) {
          continue;
        }

        const ctx = extractContext(lines, i);

        if (hasTrackingComment(ctx)) {
          continue;
        }

        violations.push({
          file,
          rule: "skipped-tests-need-tracking",
          message: `Line ${String(i + 1)}: \`${label}\` without a tracking comment. Add an issue URL or \`TODO(@owner)\` on the same line or the line above so the skip has an owner.`
        });
      }
    }
  }

  return violations;
}

export const skippedTestsNeedTrackingRule: IMetaRule = {
  id: "skipped-tests-need-tracking",
  category: "testing",
  description:
    "Skipped tests (.skip/.only/xit/xdescribe) must carry an issue URL or TODO(@owner) so the debt has a tracked owner.",
  run({ root }) {
    return checkSkippedTestsHaveTracking(root);
  }
};
