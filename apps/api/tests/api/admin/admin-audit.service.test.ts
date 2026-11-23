import { beforeEach, describe, expect, test } from "bun:test";

import { adminAuditService } from "../../../src/api/admin/admin-audit.service";
import { auditLogService } from "../../../src/lib/audit-log";
import { cleanDatabase, requireDb } from "../../helpers/db";

describe("adminAuditService.listRecent", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns newest first and never carries actor emails or metadata", async () => {
    if (!(await requireDb())) {
      return;
    }

    await auditLogService.record({
      userId: null,
      action: "account.created",
      resource: "account:first",
      metadata: { note: "first" },
    });
    await auditLogService.record({
      userId: null,
      action: "account.updated",
      resource: "account:second",
      metadata: { note: "second" },
    });

    const entries = await adminAuditService.listRecent({ limit: 10 });
    const [newest, next] = entries;

    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(Date.parse(newest?.createdAt ?? "")).toBeGreaterThanOrEqual(
      Date.parse(next?.createdAt ?? "")
    );
    expect(Object.keys(newest ?? {})).not.toContain("metadata");
    expect(Object.keys(newest ?? {})).not.toContain("actorEmail");
  });

  test("clamps the page size", async () => {
    if (!(await requireDb())) {
      return;
    }

    const entries = await adminAuditService.listRecent({ limit: 100000 });

    expect(entries.length).toBeLessThanOrEqual(100);
  });
});
