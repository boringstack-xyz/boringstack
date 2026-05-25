import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const CROSS_WORKSPACE_MARKERS = ["apps/api", "infra/compose"] as const;

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
  for (const marker of CROSS_WORKSPACE_MARKERS) {
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
          message: `Import "${specifier}" references workspace "${marker}". apps/ui must not import backend or infra source directly — duplicate shared constants locally and sync by test or codegen.`
        });
        continue;
      }

      const resolved = resolve(dirname(file), specifier);

      if (!isPathInsideRoot(rootResolved, resolved)) {
        violations.push({
          file,
          rule: "no-cross-repo-import",
          message: `Import "${specifier}" resolves outside apps/ui (${relative(rootResolved, resolved)}). Keep UI imports inside the workspace and sync cross-app contracts by test or codegen.`
        });
      }
    }
  }

  return violations;
}

/**
 * Relative imports that escape apps/ui couple the frontend directly to backend
 * or infra source. Keep cross-app contracts explicit through OpenAPI, generated
 * ACL types, or local mirrored constants with tests.
 */
export const noCrossRepoImportRule: IMetaRule = {
  id: "no-cross-repo-import",
  category: "source-text",
  description:
    "Relative imports must stay inside apps/ui; no backend or infra source paths.",
  ciCritical: true,
  run({ root, sourceFiles }) {
    return checkNoCrossRepoImports(root, sourceFiles);
  }
};
