import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

const ROLE_LITERALS = new Set(["owner", "admin", "member", "viewer"]);

const ROLE_LITERAL_FILE_ALLOWLIST = [
  /[/\\]acl\.constants\.ts$/u,
  /[/\\]acl\.types\.generated\.ts$/u,
  /[/\\]schema\.d\.ts$/u,
  /[/\\]lint-meta[/\\]fixtures[/\\]/u,
];

const ROLE_LITERAL_PATH_SKIP = [/\.test\.(ts|tsx)$/u, /\.stories\.(tsx|ts)$/u];

function isRoleLiteralAllowedPath(relativePath: string): boolean {
  if (ROLE_LITERAL_PATH_SKIP.some((pattern) => pattern.test(relativePath))) {
    return true;
  }

  return ROLE_LITERAL_FILE_ALLOWLIST.some((pattern) =>
    pattern.test(relativePath)
  );
}

export function checkNoRawRoleLiterals(
  root: string,
  files: readonly string[]
): IViolation[] {
  const violations: IViolation[] = [];
  const pattern = /["'](owner|admin|member|viewer)["']/gu;

  for (const file of files) {
    const relative = file.startsWith(root) ? file.slice(root.length + 1) : file;

    if (!relative.startsWith("src/")) {
      continue;
    }

    if (isRoleLiteralAllowedPath(relative)) {
      continue;
    }

    const lines = readFileSync(file, "utf8").split("\n");

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index] ?? "";
      const trimmed = line.trim();

      if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
        continue;
      }

      for (const match of line.matchAll(pattern)) {
        const literal = match[1];

        if (literal === undefined || !ROLE_LITERALS.has(literal)) {
          continue;
        }

        violations.push({
          file,
          rule: "no-raw-role-literal",
          message: `Line ${String(index + 1)}: use ROLE.${literal} from acl.constants.ts instead of "${literal}".`,
        });
      }
    }
  }

  return violations;
}

/** ACL role strings must use ROLE.* constants, not raw string literals. */
export const noRawRoleLiteralsRule: IMetaRule = {
  id: "no-raw-role-literal",
  category: "source-text",
  description:
    "Use ROLE.* from acl.constants.ts instead of raw owner/admin/member/viewer string literals.",
  run({ root, sourceFiles }) {
    return checkNoRawRoleLiterals(root, sourceFiles);
  },
};
