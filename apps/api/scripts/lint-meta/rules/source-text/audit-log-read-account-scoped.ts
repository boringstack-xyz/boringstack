import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

/*
 * Audit-log reads are tenant data. A query that filters auditLog by
 * userId alone returns the user's events from EVERY account they belong
 * to, bleeding account-level activity (billing changes, invitations,
 * feature overrides) across tenant boundaries — the dashboard feed
 * shipped exactly this defect. The schema carries an indexed
 * targetAccountId for scoping, so any file that filters on
 * eq(auditLog.userId, …) must also reference auditLog.targetAccountId
 * in its query. Write paths (inserts) and join conditions like
 * eq(users.id, auditLog.userId) don't match the filter pattern, so the
 * check stays precise without an allowlist.
 */
const RULE = "audit-log-read-account-scoped";
const USER_FILTER_RE = /eq\(auditLog\.userId\b/u;
const ACCOUNT_SCOPE_TOKEN = "auditLog.targetAccountId";

export function checkAuditLogReadAccountScoped(
  root: string,
  sourceFiles: readonly string[]
): IViolation[] {
  const violations: IViolation[] = [];

  for (const file of sourceFiles) {
    const relative = file.startsWith(root) ? file.slice(root.length + 1) : file;

    if (!relative.startsWith("src/") || relative.endsWith(".test.ts")) {
      continue;
    }

    const content = readFileSync(file, "utf8");

    if (
      !USER_FILTER_RE.test(content) ||
      content.includes(ACCOUNT_SCOPE_TOKEN)
    ) {
      continue;
    }

    const lines = content.split("\n");

    for (let index = 0; index < lines.length; index++) {
      if (!USER_FILTER_RE.test(lines[index] ?? "")) {
        continue;
      }

      violations.push({
        file,
        rule: RULE,
        message: `Line ${String(index + 1)}: auditLog query filters by userId without targetAccountId scoping — a multi-account user sees events from every account. Add an auditLog.targetAccountId clause (or isNull for user-level events).`,
      });
    }
  }

  return violations;
}

/** auditLog reads filtered by userId must also scope on targetAccountId. */
export const auditLogReadAccountScopedRule: IMetaRule = {
  id: "audit-log-read-account-scoped",
  category: "source-text",
  description:
    "Queries filtering auditLog by userId must also reference auditLog.targetAccountId — userId-only reads bleed a multi-account user's events across tenant boundaries.",
  run({ root, sourceFiles }) {
    return checkAuditLogReadAccountScoped(root, sourceFiles);
  },
};
