import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

/*
 * Credentials that once shipped as documented defaults and were removed
 * (2026-06-03: dev.sh now generates random passwords). Docs teaching a
 * retired default trains users to hardcode it back — every literal here
 * must stay banned from documentation prose forever.
 */
const RETIRED_CREDENTIALS = [
  "admin123456",
  "admin / change-me",
  "password123",
  "demo@example.com / password123"
] as const;

const DOC_EXTENSIONS = new Set([".md", ".mdx"]);

function collectDocFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];

  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = join(dir, entry);

    let isDir: boolean;

    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      out.push(...collectDocFiles(full));
      continue;
    }

    if (DOC_EXTENSIONS.has(extname(full))) {
      out.push(full);
    }
  }

  return out;
}

export function checkDocsNoRetiredCredentials(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const docsContent = join(dirname(root), "docs", "src", "content");

  if (!existsSync(docsContent)) {
    return violations;
  }

  for (const file of collectDocFiles(docsContent)) {
    const text = readFileSync(file, "utf8");

    for (const literal of RETIRED_CREDENTIALS) {
      if (text.includes(literal)) {
        violations.push({
          file,
          rule: "docs-no-retired-credentials",
          message: `Documentation references the retired default credential \`${literal}\` — it was removed from the stack (random per-install generation) and teaching it invites users to hardcode it back.`
        });
      }
    }
  }

  return violations;
}

/** Docs must never teach credentials the stack has retired. */
export const docsNoRetiredCredentialsRule: IMetaRule = {
  id: "docs-no-retired-credentials",
  category: "source-text",
  description:
    "Documentation prose must not reference retired default credentials.",
  run({ root }) {
    return checkDocsNoRetiredCredentials(root);
  }
};
