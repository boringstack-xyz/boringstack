import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

/**
 * Canonical helper registry for the UI app. Every entry pins ONE
 * function name to ONE source-of-truth module. Any other file
 * declaring the same name (top-level `const NAME = ...`, `function
 * NAME(...)`, `let NAME = ...`) is a duplicate and the rule fails the
 * build.
 *
 * Add a new entry the moment a second copy appears anywhere — that's
 * the signal that the helper deserves a single home.
 */
const CANONICAL_HELPERS: readonly {
  readonly name: string;
  readonly canonicalSrc: string;
}[] = [
  /*
   * Seed the registry with no entries — the API side carries the
   * deliverability helpers. New UI helpers (formatters, validators,
   * etc.) are added as duplicates are spotted.
   */
];

const DECLARATION_PATTERNS = [
  /(?:^|\n)\s*(?:export\s+)?const\s+NAME\s*[=:]/u,
  /(?:^|\n)\s*(?:export\s+)?function\s+NAME\s*\(/u,
  /(?:^|\n)\s*(?:export\s+)?let\s+NAME\s*[=:]/u
];

const buildPatterns = (name: string): RegExp[] =>
  DECLARATION_PATTERNS.map(
    (tpl) => new RegExp(tpl.source.replace("NAME", name), "u")
  );

export function checkCanonicalHelpersSingleHome(
  file: string,
  root: string
): IViolation[] {
  const violations: IViolation[] = [];
  const relative = file.startsWith(`${root}/`)
    ? file.slice(root.length + 1)
    : file;
  const text = readFileSync(file, "utf8");

  for (const entry of CANONICAL_HELPERS) {
    if (relative === entry.canonicalSrc) {
      continue;
    }

    const declaresHere = buildPatterns(entry.name).some((pattern) =>
      pattern.test(text)
    );

    if (!declaresHere) {
      continue;
    }

    violations.push({
      file,
      rule: "canonical-helpers-single-home",
      message: `Redeclaration of \`${entry.name}\`. The canonical version lives in \`${entry.canonicalSrc}\` — import from there instead of reinventing it.`
    });
  }

  return violations;
}

/**
 * Forbid redeclaring known canonical helpers outside their single
 * source-of-truth module. The UI's registry is intentionally empty at
 * the time of introduction; entries are added as duplicates appear.
 */
export const canonicalHelpersSingleHomeRule: IMetaRule = {
  id: "canonical-helpers-single-home",
  category: "source-text",
  description:
    "Helpers in the canonical registry must only be declared in their single source-of-truth file.",
  run({ root, sourceFiles }) {
    return sourceFiles.flatMap((file) =>
      checkCanonicalHelpersSingleHome(file, root)
    );
  }
};
