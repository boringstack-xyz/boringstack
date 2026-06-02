import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { AUDIT_ACTIONS, auditLogService } from "../../../src/lib/audit-log";
import { auditLog, users } from "../../../src/clients/postgres/schema";
import { cleanDatabase, db, requireDb } from "../../helpers/db";

const TEST_USER_EMAIL = "audit-test@example.com";

const insertTestUser = async (): Promise<string> => {
  const [created] = await db
    .insert(users)
    .values({ email: TEST_USER_EMAIL, firstName: "A", lastName: "T" })
    .returning();

  if (!created) {
    throw new Error("Failed to insert test user");
  }

  return created.id;
};

describe("AuditLogService.record", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("writes a row with the given action and metadata", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser();
    const result = await auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
      metadata: { source: "test" },
      ip: "127.0.0.1",
      userAgent: "bun:test",
    });

    expect(result.success).toBe(true);

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe(AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS);
    expect(rows[0]?.metadata).toEqual({ source: "test" });
    expect(rows[0]?.ip).toBe("127.0.0.1");
    expect(rows[0]?.userAgent).toBe("bun:test");
  });

  test("accepts a null userId for system-initiated events", async () => {
    if (!(await requireDb())) {
      return;
    }

    const result = await auditLogService.record({
      userId: null,
      action: "system.cron.tick",
    });

    expect(result.success).toBe(true);

    const rows = await db.select().from(auditLog);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBeNull();
    expect(rows[0]?.action).toBe("system.cron.tick");
  });

  test("defaults metadata to an empty object when omitted", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser();

    await auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_REGISTER,
    });
    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId));

    expect(rows[0]?.metadata).toEqual({});
    expect(rows[0]?.ip).toBeNull();
    expect(rows[0]?.userAgent).toBeNull();
  });

  test("returns success=false without throwing when the DB insert fails", async () => {
    if (!(await requireDb())) {
      return;
    }

    const result = await auditLogService.record({
      userId: "not-a-real-uuid",
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
    });

    expect(result.success).toBe(false);
  });

  test("includes resource in the persisted row when provided", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser();

    await auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
      resource: "notification:abc-123",
    });

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.resource).toBe("notification:abc-123");
  });

  test("persists targetAccountId when provided", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser();
    const accountId = crypto.randomUUID();

    await auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.BILLING_CHECKOUT_SESSION_CREATED,
      targetAccountId: accountId,
      metadata: { accountId },
    });

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetAccountId).toBe(accountId);
  });
});

describe("AuditLogService.listForAccount", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns events matched by targetAccountId without an account resource", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser();
    const accountId = crypto.randomUUID();

    /*
     * The shape billing checkout/portal events write: an entity-free
     * record whose only tenant link is targetAccountId. Before that
     * column was persisted, these events were invisible to the
     * account audit trail.
     */
    await auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.BILLING_CHECKOUT_SESSION_CREATED,
      targetAccountId: accountId,
      metadata: { accountId },
    });

    await auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
    });

    const { entries } = await auditLogService.listForAccount({ accountId });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.action).toBe(
      AUDIT_ACTIONS.BILLING_CHECKOUT_SESSION_CREATED
    );
  });

  test("still returns events matched by the account:{id} resource convention", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser();
    const accountId = crypto.randomUUID();

    await auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.ACCOUNT_UPDATED,
      resource: `account:${accountId}`,
    });

    const { entries } = await auditLogService.listForAccount({ accountId });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.action).toBe(AUDIT_ACTIONS.ACCOUNT_UPDATED);
  });
});
