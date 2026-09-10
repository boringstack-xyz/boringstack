import { readFileSync } from "node:fs";
import { join } from "node:path";

import { collectSourceFiles } from "../../context";
import type { IMetaRule, IViolation } from "../../types";

/*
 * `security-spec/` inverts the meaning of a green run.
 *
 * Every test in it asserts behaviour a finding says is missing, so it is
 * supposed to fail; a red run means the findings are outstanding and a green
 * run means they are fixed. That makes the ordinary integration-test posture
 * exactly wrong. `tests/helpers/db.ts` documents that its guards "bail
 * silently when no Postgres is reachable" — right for the main suite, fatal
 * here, because a test that bails is a test that passes, and a suite of
 * bailing tests reports every finding as fixed.
 *
 * `security-spec/harness.ts` exists to be the inverse: `requireDbOrFail` and
 * `requireValkeyOrFail` throw where the normal helpers return `false`. This
 * rule keeps the two apart, so the silent-bail habit cannot leak back in —
 * 440 sites across the main suite make that a very well-worn habit.
 *
 * Skips are banned outright rather than tracked. `skipped-tests-need-tracking`
 * lets a skip through with a `TODO(@owner)`, which is the right trade in a
 * suite that is meant to be green. Here a skipped case is indistinguishable
 * from a fixed finding, and the manifest reconciler rejects it at run time —
 * this rule moves that rejection to lint time.
 */
const BAILING_GUARDS: readonly { pattern: RegExp; name: string }[] = [
  { pattern: /\brequireDb\s*\(/u, name: "requireDb()" },
  { pattern: /\brequireValkey\s*\(/u, name: "requireValkey()" },
  { pattern: /\bisDbAvailable\s*\(/u, name: "isDbAvailable()" },
  { pattern: /\bisValkeyReachable\s*\(/u, name: "isValkeyReachable()" },
];

const SKIP_CONSTRUCTS: readonly { pattern: RegExp; name: string }[] = [
  { pattern: /\b(?:it|test|describe)\.skip\s*\(/u, name: ".skip(" },
  { pattern: /\b(?:it|test|describe)\.only\s*\(/u, name: ".only(" },
  { pattern: /\b(?:it|test|describe)\.todo\s*\(/u, name: ".todo(" },
  { pattern: /\b(?:it|test|describe)\.failing\s*\(/u, name: ".failing(" },
  { pattern: /\b(?:it|test|describe)\.if\s*\(/u, name: ".if(" },
  { pattern: /\bxit\s*\(/u, name: "xit(" },
  { pattern: /\bxdescribe\s*\(/u, name: "xdescribe(" },
  { pattern: /\bxtest\s*\(/u, name: "xtest(" },
];

const RULE_ID = "security-spec-no-silent-bail";
const SPEC_DIR = "security-spec";

/*
 * The rule reads its own source when lint:meta scans `scripts/`, and the
 * pattern table above would then match itself. Only `security-spec/*.test.ts`
 * is scanned, so that cannot happen — but the guard names also appear in the
 * spec suite's own prose, which can. Comment and string content is stripped
 * before matching so an explanation of why a guard is banned is not itself a
 * violation.
 */
function stripCommentsAndStrings(line: string): string {
  return line
    .replace(/\/\/.*$/u, "")
    .replace(/\/\*.*?\*\//gu, "")
    .replace(/^\s*\*.*$/u, "")
    .replace(/"(?:[^"\\]|\\.)*"/gu, '""')
    .replace(/'(?:[^'\\]|\\.)*'/gu, "''")
    .replace(/`(?:[^`\\]|\\.)*`/gu, "``");
}

export function checkSecuritySpecNoSilentBail(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const files = collectSourceFiles(join(root, SPEC_DIR), []);

  for (const file of files) {
    if (!file.endsWith(".test.ts")) {
      continue;
    }

    const lines = readFileSync(file, "utf8").split("\n");

    for (const [index, raw] of lines.entries()) {
      const line = stripCommentsAndStrings(raw);

      for (const { pattern, name } of BAILING_GUARDS) {
        if (pattern.test(line)) {
          violations.push({
            file,
            rule: RULE_ID,
            message: `Line ${String(index + 1)}: \`${name}\` returns false when the dependency is missing, so the test passes instead of running. Use \`requireDbOrFail()\` / \`requireValkeyOrFail()\` from \`security-spec/harness\`, which throw.`,
          });
        }
      }

      for (const { pattern, name } of SKIP_CONSTRUCTS) {
        if (pattern.test(line)) {
          violations.push({
            file,
            rule: RULE_ID,
            message: `Line ${String(index + 1)}: \`${name}\` is not allowed here. A skipped case is indistinguishable from a fixed finding; delete the case and its manifest row, or mark the finding \`refuted\`.`,
          });
        }
      }
    }
  }

  return violations;
}

export const securitySpecNoSilentBailRule: IMetaRule = {
  id: RULE_ID,
  category: "testing",
  description:
    "security-spec tests must fail when a dependency is missing: no silent-bail guards (requireDb/requireValkey/isDbAvailable/isValkeyReachable) and no skipped cases.",
  run({ root }) {
    return checkSecuritySpecNoSilentBail(root);
  },
};
