import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const RULE_ID = "eslint-ban-type-assertions";
const CONFIG_NAMES = [
  "eslint.config.mjs",
  "eslint.config.js",
  "eslint.config.mts",
  "eslint.config.cjs"
];
const RULE_NAME = "@typescript-eslint/consistent-type-assertions";
const EXEMPTION_MARKER = "eslint-meta-allow-assertion-exemption";

/*
 * `assertionStyle: "as" | "angle-bracket"` only enforces *which syntax* an
 * assertion uses — it still permits them. Only "never" bans `as` outright.
 * A config that drifts to "as" silently re-opens the hole (this is the exact
 * bug that once let casts ship: the UI rule was set to "as", not "never").
 */
const ASSERTION_STYLE_RE =
  /assertionStyle\s*:\s*["'](never|as|angle-bracket)["']/gu;
const RULE_OFF_RE =
  /["']@typescript-eslint\/consistent-type-assertions["']\s*:\s*["']off["']/u;

// Strip a trailing line comment so a marker can't satisfy the style/off match.
function stripLineComment(raw: string): string {
  return raw.replace(/\/\/.*$/u, "");
}

function hasNeverPin(lines: readonly string[]): boolean {
  return lines.some((raw) =>
    [...stripLineComment(raw).matchAll(ASSERTION_STYLE_RE)].some(
      (match) => match[1] === "never"
    )
  );
}

function lineViolations(
  file: string,
  raw: string,
  lineNo: number
): IViolation[] {
  const out: IViolation[] = [];
  const code = stripLineComment(raw);

  for (const match of code.matchAll(ASSERTION_STYLE_RE)) {
    if (match[1] !== "never") {
      out.push({
        file,
        rule: RULE_ID,
        message: `Line ${String(lineNo)}: \`assertionStyle: "${match[1] ?? ""}"\` still permits \`as\` casts — pin it to "never". A weaker style silently re-opens the type-assertion hole.`
      });
    }
  }

  // The marker must sit on the same line as the off (raw still has comments).
  if (RULE_OFF_RE.test(code) && !raw.includes(EXEMPTION_MARKER)) {
    out.push({
      file,
      rule: RULE_ID,
      message: `Line ${String(lineNo)}: \`${RULE_NAME}\` is disabled without justification — add \`// ${EXEMPTION_MARKER}: <reason>\` on the same line to sanction a genuine, audited type-boundary exemption.`
    });
  }

  return out;
}

function checkConfigFile(file: string): IViolation[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const violations = lines.flatMap((raw, i) =>
    lineViolations(file, raw, i + 1)
  );

  if (!hasNeverPin(lines)) {
    violations.push({
      file,
      rule: RULE_ID,
      message: `${file}: \`${RULE_NAME}\` must be pinned to \`assertionStyle: "never"\`. The no-\`as\` rule is a core merge-bar contract and must be enforced explicitly, never assumed.`
    });
  }

  return violations;
}

export function checkEslintBanTypeAssertions(root: string): IViolation[] {
  return CONFIG_NAMES.map((name) => join(root, name))
    .filter((full) => existsSync(full))
    .flatMap(checkConfigFile);
}

/**
 * Guards the guard: the no-`as` merge-bar contract is only real while the
 * ESLint rule that enforces it stays pinned to `assertionStyle: "never"`. Fails
 * if a config weakens the style or disables the rule without an audited
 * `eslint-meta-allow-assertion-exemption` marker.
 */
export const eslintBanTypeAssertionsRule: IMetaRule = {
  id: RULE_ID,
  category: "config",
  description:
    'ESLint must pin @typescript-eslint/consistent-type-assertions to assertionStyle "never"; disabling it requires an audited eslint-meta-allow-assertion-exemption marker.',
  run({ root }) {
    return checkEslintBanTypeAssertions(root);
  }
};
