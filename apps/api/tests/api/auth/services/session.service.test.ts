import { beforeEach, describe, expect, test } from "bun:test";

import { seedVerifiedUser } from "../../../helpers/auth";
import { sessionService } from "../../../../src/api/auth/services/session.service";
import { ApiError } from "../../../../src/lib/errors";
import { hashOpaqueToken } from "../../../../src/lib/tokens";
import {
  authSessions,
  cleanDatabase,
  db,
  eq,
  requireDb,
} from "../../../helpers/db";

const PASSWORD = "Hunter2Strong!";

async function seedUser(email = "session@example.com"): Promise<string> {
  const { user } = await seedVerifiedUser({
    email,
    password: PASSWORD,
    firstName: "Session",
    lastName: "Tester",
  });

  return user.id;
}

describe("SessionService.create", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns a raw token + expiry and persists exactly one session row keyed on the hashed token", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const { token, expiresAt } = await sessionService.create(userId);

    expect(token).toBeTypeOf("string");
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);

    const rows = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(hashOpaqueToken(token));
    expect(rows[0]?.previousTokenHash).toBeNull();
  });

  test("two consecutive create() calls produce independent rows with distinct familyIds", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const first = await sessionService.create(userId);
    const second = await sessionService.create(userId);

    expect(first.token).not.toBe(second.token);

    const rows = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, userId));

    expect(rows).toHaveLength(2);

    const familyIds = new Set(rows.map((row) => row.familyId));

    expect(familyIds.size).toBe(2);
  });
});

describe("SessionService.refresh", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("rotates: returns a new token, updates the row's tokenHash, and stores the prior hash as previousTokenHash", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const initial = await sessionService.create(userId);

    const rotated = await sessionService.refresh(initial.token);

    expect(rotated.token).toBeTypeOf("string");
    expect(rotated.token).not.toBe(initial.token);
    expect(rotated.user.id).toBe(userId);

    const rows = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(hashOpaqueToken(rotated.token));
    expect(rows[0]?.previousTokenHash).toBe(hashOpaqueToken(initial.token));
  });

  test("detects replay: presenting the already-rotated token deletes the entire family", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const initial = await sessionService.create(userId);

    await sessionService.refresh(initial.token);

    let caught: unknown;

    try {
      await sessionService.refresh(initial.token);
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.statusCode).toBe(401);
    }

    const remaining = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, userId));

    expect(remaining).toHaveLength(0);
  });

  test("rejects an unknown token with 401", async () => {
    if (!(await requireDb())) {
      return;
    }

    let caught: unknown;

    try {
      await sessionService.refresh("ff".repeat(32));
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.statusCode).toBe(401);
    }
  });

  test("rejects an expired token with 401 and leaves the row untouched", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const initial = await sessionService.create(userId);

    await db
      .update(authSessions)
      .set({ expiresAt: "2000-01-01T00:00:00.000Z" })
      .where(eq(authSessions.userId, userId));

    let caught: unknown;

    try {
      await sessionService.refresh(initial.token);
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.statusCode).toBe(401);
    }

    const rows = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(hashOpaqueToken(initial.token));
  });
});

describe("SessionService.revoke", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("deletes the row matching the presented token", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const { token } = await sessionService.create(userId);

    await sessionService.revoke(token);

    const rows = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, userId));

    expect(rows).toHaveLength(0);
  });

  test("deletes the row when the presented token matches the previousTokenHash slot", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const initial = await sessionService.create(userId);

    await sessionService.refresh(initial.token);
    await sessionService.revoke(initial.token);

    const rows = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, userId));

    expect(rows).toHaveLength(0);
  });

  test("is a no-op for an unknown token", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();

    await sessionService.create(userId);
    await sessionService.revoke("aa".repeat(32));

    const rows = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, userId));

    expect(rows).toHaveLength(1);
  });
});

describe("SessionService.revokeAllForUser", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("deletes every session row for the targeted user and leaves other users alone", async () => {
    if (!(await requireDb())) {
      return;
    }

    const targetId = await seedUser("target@example.com");
    const otherId = await seedUser("other@example.com");

    await sessionService.create(targetId);
    await sessionService.create(targetId);
    await sessionService.create(otherId);

    await sessionService.revokeAllForUser(targetId);

    const targetRows = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, targetId));

    expect(targetRows).toHaveLength(0);

    const otherRows = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, otherId));

    expect(otherRows).toHaveLength(1);
  });
});
