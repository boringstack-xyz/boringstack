import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

/**
 * A fixed-value field (one typed as a `t.Union([t.Literal(...)])` in ANY schema in a
 * `*.schemas.ts` file) must be typed the SAME way in EVERY schema in that file — never
 * widened to `t.String()` (e.g. in the response schema).
 *
 * Why this is a gate error, not a style nit: the response schema becomes the OpenAPI
 * spec, which `generate:api` turns into the UI's typed client — the single source of
 * truth for the UI's API types. If a `status` field is `t.Union([t.Literal("todo"),…])`
 * on input but `t.String()` on the response, the generated client types the response
 * `status` as `string`. The UI (which expects the enum) then can't reconcile `string`
 * with `"todo"|"doing"|"done"`, and a weak model "fixes" the clash by reverting/stubbing
 * the feature instead of tightening the schema — the exact near-green oscillation this
 * rule prevents. Define the enum once and reuse it in create/update/response/query.
 */

/**
 * Field names given a `t.Union([t.Literal(...)])` type anywhere in the (whitespace-
 *  collapsed) schema source.
 */
function literalUnionFields(collapsed: string): Set<string> {
  const out = new Set<string>();
  const re =
    /(\w+)\s*:\s*(?:t\.Optional\(\s*)?t\.Union\(\s*\[\s*t\.Literal\b/gu;

  for (const m of collapsed.matchAll(re)) {
    if (m[1] !== undefined) {
      out.add(m[1]);
    }
  }

  return out;
}

/**
 * Field names given a bare `t.String(...)` type (optionally wrapped in `t.Optional`).
 *  Deliberately does NOT match `t.Union([t.String(), t.Null()])` (a nullable string is
 *  not an enum field) — the `t.String` must sit directly under the field or `t.Optional`.
 */
function plainStringFields(collapsed: string): Set<string> {
  const out = new Set<string>();
  const re = /(\w+)\s*:\s*(?:t\.Optional\(\s*)?t\.String\s*\(/gu;

  for (const m of collapsed.matchAll(re)) {
    if (m[1] !== undefined) {
      out.add(m[1]);
    }
  }

  return out;
}

/**
 * Pure analyzer (no filesystem): the field names that are BOTH a literal-union enum and
 *  a bare t.String() somewhere in one schema source — i.e. inconsistently typed. Sorted
 *  for deterministic output. Exported for direct unit testing.
 */
export function inconsistentEnumFields(src: string): string[] {
  if (!src.includes("t.Literal(")) {
    return [];
  }

  const collapsed = src.replace(/\s+/gu, " ");
  const enums = literalUnionFields(collapsed);
  const strings = plainStringFields(collapsed);

  return [...enums].filter((field) => strings.has(field)).sort();
}

export function checkSchemaEnumFieldConsistency(
  root: string,
  files: readonly string[]
): IViolation[] {
  const violations: IViolation[] = [];

  for (const file of files) {
    const relative = file.startsWith(root) ? file.slice(root.length + 1) : file;

    // Only real TypeBox schema files (never test fixtures): under src/, `*.schemas.ts`.
    if (!/(?:^|[/\\])src[/\\].*\.schemas\.ts$/u.test(relative)) {
      continue;
    }

    for (const field of inconsistentEnumFields(readFileSync(file, "utf8"))) {
      violations.push({
        file,
        rule: "schema-enum-field-consistency",
        message:
          `Field '${field}' is a t.Union([t.Literal(...)]) enum in one schema in this ` +
          `file but t.String() in another. Widening it to t.String() (typically in the ` +
          `response schema) makes the generated API client type '${field}' as a plain ` +
          `string, which the UI can't reconcile with the enum. Define the enum ONCE and ` +
          `reuse it in every schema (create/update/response/query) — never t.String().`,
      });
    }
  }

  return violations;
}

/**
 * Enum-like TypeBox fields must be typed identically across every schema in a file
 *  (never widened to t.String() in the response), so the generated client stays precise.
 */
export const schemaEnumFieldConsistencyRule: IMetaRule = {
  id: "schema-enum-field-consistency",
  category: "source-text",
  description:
    "A fixed-value field typed as t.Union([t.Literal(...)]) in one schema must not be " +
    "t.String() in another schema in the same file — keep the generated API client precise.",
  run({ root, sourceFiles }) {
    return checkSchemaEnumFieldConsistency(root, sourceFiles);
  },
};
