import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

/*
 * The UI's typed `env` export (`apps/ui/src/lib/env/index.ts`) is the
 * only sanctioned access to runtime config. Every other file imports
 * from it so typos and missing keys surface as a build error instead
 * of `undefined` flowing through the app.
 */
const ALLOWLIST = new Set(["src/lib/env/env.loader.ts"]);

const PATTERN = /\bimport\s*\.\s*meta\s*\.\s*env\b/u;

export function checkNoDirectImportMetaEnv(
  root: string,
  files: readonly string[]
): IViolation[] {
  const violations: IViolation[] = [];

  for (const file of files) {
    const relative = file.startsWith(root) ? file.slice(root.length + 1) : file;

    if (!relative.startsWith("src/")) {
      continue;
    }

    if (ALLOWLIST.has(relative)) {
      continue;
    }

    const text = readFileSync(file, "utf8");

    if (!PATTERN.test(text)) {
      continue;
    }

    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .replace(/^\s*\/\/.*$/gmu, "");

    if (!PATTERN.test(stripped)) {
      continue;
    }

    violations.push({
      file,
      rule: "env-no-direct-import-meta-env",
      message:
        "Direct `import.meta.env` access is forbidden outside src/lib/env/env.loader.ts. Import the typed `env` object from `@/lib/env` instead."
    });
  }

  return violations;
}

export const noDirectImportMetaEnvRule: IMetaRule = {
  id: "env-no-direct-import-meta-env",
  category: "env",
  description:
    "Single entry point for env: every source file outside env.loader.ts must import the typed `env` object instead of reading `import.meta.env` directly.",
  run({ root, sourceFiles }) {
    return checkNoDirectImportMetaEnv(root, sourceFiles);
  }
};
