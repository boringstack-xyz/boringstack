import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const SIBLING_REPO_MARKERS = ["api-template", "infra-template"] as const;

const RELATIVE_IMPORT_SPECIFIER_RE =
  /\b(?:from|import)\s*(?:type\s*)?["'](\.\.[^"']+)["']/gu;

function isPathInsideRoot(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));

  return (
    rel === "" ||
    (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))
  );
}

function siblingRepoMarker(specifier: string): string | null {
  for (const marker of SIBLING_REPO_MARKERS) {
    if (specifier.includes(marker)) {
      return marker;
    }
  }

  return null;
}

export function checkNoCrossRepoImports(
  root: string,
  files: readonly string[]
): IViolation[] {
  const violations: IViolation[] = [];
  const rootResolved = resolve(root);

  for (const file of files) {
    const text = readFileSync(file, "utf8");

    for (const match of text.matchAll(RELATIVE_IMPORT_SPECIFIER_RE)) {
      const specifier = match[1];

      if (specifier === undefined) {
        continue;
      }

      const marker = siblingRepoMarker(specifier);

      if (marker !== null) {
        violations.push({
          file,
          rule: "no-cross-repo-import",
          message: `Import "${specifier}" references sibling repo "${marker}". ui-template CI runs in isolation — duplicate shared constants locally and sync by test or codegen.`
        });
        continue;
      }

      const resolved = resolve(dirname(file), specifier);

      if (!isPathInsideRoot(rootResolved, resolved)) {
        violations.push({
          file,
          rule: "no-cross-repo-import",
          message: `Import "${specifier}" resolves outside the ui-template repo (${relative(rootResolved, resolved)}). CI checks out this repo alone — sibling directories are not available.`
        });
      }
    }
  }

  return violations;
}

/**
 * CI checks out ui-template alone. Relative imports that escape the repo or
 * reference sibling templates typecheck locally in a monorepo but fail in CI.
 */
export const noCrossRepoImportRule: IMetaRule = {
  id: "no-cross-repo-import",
  category: "source-text",
  description:
    "Relative imports must stay inside this repo; no sibling-template paths.",
  ciCritical: true,
  run({ root, sourceFiles }) {
    return checkNoCrossRepoImports(root, sourceFiles);
  }
};
