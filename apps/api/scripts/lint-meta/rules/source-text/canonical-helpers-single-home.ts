import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

/**
 * Canonical helper registry. Every entry pins ONE function name to ONE
 * source-of-truth module. Any other file declaring the same name (top-level
 * `const NAME = ...`, `function NAME(...)`, `let NAME = ...`) is a
 * duplicate and the rule fails the build.
 *
 * Add a new entry the moment a second copy of a helper appears anywhere
 * in the codebase — that is the signal that the helper deserves a
 * single home.
 *
 * `canonicalSrc` is the path relative to repo root.
 */
const CANONICAL_HELPERS: readonly {
  readonly name: string;
  readonly canonicalSrc: string;
}[] = [
  {
    name: "normalizeEmail",
    canonicalSrc: "src/lib/email/email.utils.ts",
  },
  {
    name: "maskEmailForLogging",
    canonicalSrc: "src/lib/email/email.utils.ts",
  },
  {
    name: "isValidEmail",
    canonicalSrc: "src/lib/email/email.utils.ts",
  },
  {
    name: "hashOpaqueToken",
    canonicalSrc: "src/lib/tokens/token-utils.ts",
  },
  {
    name: "generateOpaqueToken",
    canonicalSrc: "src/lib/tokens/token-utils.ts",
  },
];

const DECLARATION_PATTERNS = [
  /(?:^|\n)\s*(?:export\s+)?const\s+NAME\s*[=:]/u,
  /(?:^|\n)\s*(?:export\s+)?function\s+NAME\s*\(/u,
  /(?:^|\n)\s*(?:export\s+)?let\s+NAME\s*[=:]/u,
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
  /*
   * Filename normalisation against the repo root: violations carry the
   * absolute path (callers prefer that for clickable IDE output) but
   * the canonical-source comparison must be path-equality after the
   * shared root is stripped.
   */
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
      message: `Redeclaration of \`${entry.name}\`. The canonical version lives in \`${entry.canonicalSrc}\` — import from there instead of reinventing it. Removing duplicates keeps the helper's behaviour (and any future fix) in one place.`,
    });
  }

  return violations;
}

/**
 * Forbid redeclaring known canonical helpers (normalizeEmail,
 * maskEmailForLogging, …) outside their single source-of-truth module.
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
  },
};
