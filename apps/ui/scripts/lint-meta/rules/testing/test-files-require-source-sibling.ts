import { existsSync } from "node:fs";
import { join } from "node:path";

import { collectSourceFiles } from "../../context";
import type { IMetaRule, IViolation } from "../../types";

/*
 * The complement of `logic-files-require-test-sibling`: every colocated
 * `*.test.ts` / `*.test.tsx` under `src/` must sit next to the source file
 * it covers. Catches orphaned tests left behind after a refactor or rename
 * (a stray test silently keeps passing while the thing it claimed to cover
 * is gone). The UI app colocates tests beside source, so this lives in
 * lint-meta rather than the ESLint `test-conventions/test-file-mirrors-source`
 * rule, which assumes a separate `tests/` tree and `.ts`-only sources.
 *
 * Tests under `tests/` (factories, lint-meta, service-worker suites) are
 * intentionally not source-mirrored and are out of scope: this rule only
 * walks `src/`.
 */
export function checkTestFilesHaveSource(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const srcRoot = join(root, "src");

  for (const file of collectSourceFiles(srcRoot)) {
    let base: string | null = null;

    if (file.endsWith(".test.ts")) {
      base = file.slice(0, -".test.ts".length);
    } else if (file.endsWith(".test.tsx")) {
      base = file.slice(0, -".test.tsx".length);
    }

    if (base === null) {
      continue;
    }

    if (existsSync(`${base}.ts`) || existsSync(`${base}.tsx`)) {
      continue;
    }

    violations.push({
      file,
      rule: "test-files-require-source-sibling",
      message: `Orphaned test. No source sibling found — expected \`${base.slice(
        root.length + 1
      )}.ts\` (or \`.tsx\`) next to this test. Rename the test to mirror the module it covers, move it beside that module, or delete it.`
    });
  }

  return violations;
}

/** Colocated *.test.ts / *.test.tsx files must mirror a source sibling. */
export const testFilesRequireSourceSiblingRule: IMetaRule = {
  id: "test-files-require-source-sibling",
  category: "testing",
  description:
    "Colocated test files must mirror a source sibling (no orphaned tests).",
  run({ root }) {
    return checkTestFilesHaveSource(root);
  }
};
