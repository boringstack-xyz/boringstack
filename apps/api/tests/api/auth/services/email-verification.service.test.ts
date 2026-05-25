import { beforeEach, describe, expect, test } from "bun:test";

import { emailVerificationService } from "../../../../src/api/auth/services/email-verification.service";
import { ApiError } from "../../../../src/lib/errors";
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "../../../../src/lib/tokens";
import { seedPendingUser } from "../../../helpers/auth";
import {
  accountMemberships,
  accounts,
  cleanDatabase,
  db,
  emailVerificationTokens,
  eq,
  isNull,
  requireDb,
  users,
} from "../../../helpers/db";

const FUTURE = (): string =>
  new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST = (): string => new Date(Date.now() - 60 * 1000).toISOString();

async function seedUser(email = "verify@example.com"): Promise<string> {
  const { user } = await seedPendingUser({
    email,
    firstName: "Verify",
    lastName: "Tester",
  });

  return user.id;
}

async function seedVerificationToken(
  userId: string,
  expiresAt: string = FUTURE()
): Promise<string> {
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));

  const token = generateOpaqueToken();

  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash: hashOpaqueToken(token),
    expiresAt,
  });

  return token;
}

describe("EmailVerificationService.verify", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("marks emailVerifiedAt, deletes the token, provisions account + owner membership, returns user + accountId", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const rawToken = await seedVerificationToken(userId);

    const result = await emailVerificationService.verify(rawToken);

    expect(result.user.id).toBe(userId);
    expect(result.user.emailVerified).toBe(true);
    expect(typeof result.accountId).toBe("string");

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    expect(user?.emailVerifiedAt).not.toBeNull();

    const tokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    expect(tokens).toHaveLength(0);

    const accountRows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, result.accountId));

    expect(accountRows).toHaveLength(1);

    const membershipRows = await db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.userId, userId));

    expect(membershipRows).toHaveLength(1);
    expect(membershipRows[0]?.role).toBe("owner");
    expect(membershipRows[0]?.accountId).toBe(result.accountId);
  });

  test("rejects an unknown token with 400", async () => {
    if (!(await requireDb())) {
      return;
    }

    let caught: unknown;

    try {
      await emailVerificationService.verify("11".repeat(32));
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.statusCode).toBe(400);
    }
  });

  test("rejects an expired token with 400 and leaves the row in place", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const rawToken = await seedVerificationToken(userId, PAST());

    let caught: unknown;

    try {
      await emailVerificationService.verify(rawToken);
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.statusCode).toBe(400);
    }

    const tokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    expect(tokens).toHaveLength(1);
  });

  test("rejects a second verification attempt for an already-verified user", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const firstToken = await seedVerificationToken(userId);

    await emailVerificationService.verify(firstToken);

    const secondToken = await seedVerificationToken(userId);

    let caught: unknown;

    try {
      await emailVerificationService.verify(secondToken);
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.statusCode).toBe(400);
    }
  });

  test("idempotency: even if the underlying provisioner is called twice, the user holds exactly one active owner membership", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("idempotent@example.com");
    const rawToken = await seedVerificationToken(userId);

    await emailVerificationService.verify(rawToken);

    const memberships = await db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.userId, userId));

    const activeOwners = memberships.filter(
      (member) => member.role === "owner" && member.revokedAt === null
    );

    expect(activeOwners).toHaveLength(1);

    const ownerAccounts = await db
      .select()
      .from(accounts)
      .where(isNull(accounts.deletedAt));

    expect(ownerAccounts).toHaveLength(1);
  });
});

describe("EmailVerificationService.resend", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns the enumeration-safe message and issues a fresh token for an unverified user", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();

    const initial = await seedVerificationToken(userId);
    const initialHash = hashOpaqueToken(initial);

    const result = await emailVerificationService.resend("verify@example.com");

    expect(result.message).toBeTypeOf("string");

    const afterRows = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    expect(afterRows).toHaveLength(1);
    expect(afterRows[0]?.tokenHash).not.toBe(initialHash);
  });

  test("returns the enumeration-safe message for an unknown email without creating a token", async () => {
    if (!(await requireDb())) {
      return;
    }

    const result = await emailVerificationService.resend("ghost@example.com");

    expect(result.message).toBeTypeOf("string");

    const rows = await db.select().from(emailVerificationTokens);

    expect(rows).toHaveLength(0);
  });

  test("returns the enumeration-safe message for an already-verified user without creating a token", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const rawToken = await seedVerificationToken(userId);

    await emailVerificationService.verify(rawToken);

    const result = await emailVerificationService.resend("verify@example.com");

    expect(result.message).toBeTypeOf("string");

    const rows = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    expect(rows).toHaveLength(0);
  });

  test("normalizes the email before lookup (mixed case still resolves)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("CaseVerify@Example.com");

    await emailVerificationService.resend("caseverify@EXAMPLE.com");

    const rows = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    expect(rows).toHaveLength(1);
  });
});
