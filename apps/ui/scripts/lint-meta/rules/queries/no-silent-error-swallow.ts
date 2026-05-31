import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

/*
 * `*.queries.ts` files must not silently swallow query errors as
 * `null`. A `catch { return null }` collapses two distinct failure
 * modes (auth failure vs network outage) into the same UX signal,
 * so consumers like ProtectedRoute can't distinguish them.
 *
 * The contract: queryFns let errors propagate (or return a typed
 * discriminated state), and consumers branch on the error type.
 * Explicit opt-out per catch via `// allow-silent: <one-line reason>`
 * on the line immediately above the `catch` keyword, for cases where
 * a literal null genuinely is the right contract (e.g. an optional
 * resource whose absence is not a UX error).
 */
const ALLOW_PATTERN = /\/\/\s*allow-silent\b/u;

interface ICatchSpan {
  readonly startLine: number; // 1-indexed
  readonly endLine: number; // 1-indexed, exclusive (line after the closing brace)
}

function findCatchSpans(text: string): ICatchSpan[] {
  const spans: ICatchSpan[] = [];
  const catchRe = /\bcatch\s*(?:\([^)]*\))?\s*\{/gu;

  let match: RegExpExecArray | null;

  while ((match = catchRe.exec(text)) !== null) {
    const openIndex = match.index + match[0].length - 1;
    let depth = 1;
    let cursor = openIndex + 1;

    while (cursor < text.length && depth > 0) {
      const ch = text[cursor];

      if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
      }

      cursor += 1;
    }

    if (depth !== 0) {
      // Unbalanced — bail to avoid false positives on a parse failure.
      continue;
    }

    const startLine = text.slice(0, match.index).split("\n").length;
    const endLine = text.slice(0, cursor).split("\n").length;

    spans.push({ startLine, endLine });
  }

  return spans;
}

export function checkNoSilentErrorSwallow(
  root: string,
  files: readonly string[]
): IViolation[] {
  const violations: IViolation[] = [];

  for (const file of files) {
    const relative = file.startsWith(root) ? file.slice(root.length + 1) : file;

    if (
      !relative.startsWith("src/features/") ||
      !relative.endsWith(".queries.ts")
    ) {
      continue;
    }

    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    const spans = findCatchSpans(text);

    for (const span of spans) {
      const blockText = lines
        .slice(span.startLine - 1, span.endLine)
        .join("\n");

      if (!/\breturn\s+null\b/u.test(blockText)) {
        continue;
      }

      const optOutLine = lines[span.startLine - 2] ?? "";

      if (ALLOW_PATTERN.test(optOutLine)) {
        continue;
      }

      violations.push({
        file,
        rule: "queries-no-silent-error-swallow",
        message: `Line ${String(span.startLine)}: catch block returns null — this conflates auth failure with network outage. Let the error propagate and branch in the consumer, or add an explicit "// allow-silent: <reason>" on the line above the catch.`
      });
    }
  }

  return violations;
}

export const noSilentErrorSwallowRule: IMetaRule = {
  id: "queries-no-silent-error-swallow",
  category: "source-text",
  description:
    "*.queries.ts files must not silently swallow query errors as `null`. Let the typed error propagate so consumers can distinguish auth from outage; opt-out per-catch with `// allow-silent: <reason>` when an explicit null is genuinely the right contract.",
  run({ root, sourceFiles }) {
    return checkNoSilentErrorSwallow(root, sourceFiles);
  }
};
