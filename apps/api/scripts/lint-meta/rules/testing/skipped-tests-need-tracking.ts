import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SOURCE_DIRS, collectSourceFiles } from "../../context";
import type { IMetaRule, IViolation } from "../../types";

/*
 * `.skip` / `xit` / `xdescribe` / `.only` are powerful escape hatches.
 * Left unowned, they rot into permanent dark zones — exactly the
 * pattern the password-reset race flake fell into. Each occurrence
 * must carry a tracking comment on the same line (or the previous one)
 * containing either an issue URL or `TODO(@owner)` so the debt has a
 * human attached to it.
 */
const SKIP_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\b(?:it|test|describe)\.skip\s*\(/u, label: ".skip(" },
  { pattern: /\b(?:it|test|describe)\.only\s*\(/u, label: ".only(" },
  { pattern: /\b(?:it|test|describe)\.fixme\s*\(/u, label: ".fixme(" },
  { pattern: /\bxit\s*\(/u, label: "xit(" },
  { pattern: /\bxdescribe\s*\(/u, label: "xdescribe(" },
  { pattern: /\bxtest\s*\(/u, label: "xtest(" },
];

const TRACKING_PATTERNS: readonly RegExp[] = [
  /https?:\/\/\S+/u,
  /TODO\([^\s)]+\)/u,
];

const TEST_FILE_SUFFIX = /\.test\.tsx?$|\.spec\.tsx?$/u;

/*
 * Window of lines above the skip to scan for a tracking comment. 30 is
 * deliberately generous — multi-paragraph JSDoc blocks explaining the
 * skip routinely run that long (see the password-reset spec), and a
 * narrower window would force the comment to hug the call site instead
 * of staying with the describe block above.
 */
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
   * Scan only the app's first-party tree (src + tests). Without this
   * scope the recursive walk descends into `node_modules` and flags
   * intentional fixture skips in vendored packages.
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
          message: `Line ${String(i + 1)}: \`${label}\` without a tracking comment. Add an issue URL or \`TODO(@owner)\` on the same line or the line above so the skip has an owner.`,
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
  },
};
