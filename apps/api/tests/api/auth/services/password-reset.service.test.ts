import { beforeEach, describe, expect, test } from "bun:test";

import { seedVerifiedUser } from "../../../helpers/auth";
import { passwordResetService } from "../../../../src/api/auth/services/password-reset.service";
import { sessionService } from "../../../../src/api/auth/services/session.service";
import { ApiError } from "../../../../src/lib/errors";
import { passwordService } from "../../../../src/lib/password";
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "../../../../src/lib/tokens";
import {
  and,
  authSessions,
  cleanDatabase,
  db,
  eq,
  passwordResetTokens,
  requireDb,
  userAuthProviders,
} from "../../../helpers/db";

const PASSWORD = "Hunter2Strong!";
const NEW_PASSWORD = "EvenStronger3!";

const RESET_TTL_FUTURE = (): string =>
  new Date(Date.now() + 60 * 60 * 1000).toISOString();
const RESET_TTL_EXPIRED = (): string =>
  new Date(Date.now() - 60 * 1000).toISOString();

async function seedUser(email = "reset@example.com"): Promise<string> {
  const { user } = await seedVerifiedUser({
    email,
    password: PASSWORD,
    firstName: "Reset",
    lastName: "Tester",
  });

  return user.id;
}

async function seedResetToken(
  userId: string,
  expiresAt: string = RESET_TTL_FUTURE()
): Promise<string> {
  const token = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(token);

  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return token;
}

describe("PasswordResetService.request", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns an enumeration-safe message for an existing user and persists a hashed token", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const result = await passwordResetService.request("reset@example.com");

    expect(result.message).toContain("a reset link was sent");

    const tokens = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.tokenHash).toHaveLength(64);
  });

  test("returns the same enumeration-safe message for an unknown email", async () => {
    if (!(await requireDb())) {
      return;
    }

    const result = await passwordResetService.request(
      "does-not-exist@example.com"
    );

    expect(result.message).toContain("a reset link was sent");

    const tokens = await db.select().from(passwordResetTokens);

    expect(tokens).toHaveLength(0);
  });

  test("returns the enumeration-safe message for an OAuth-only user with no password and writes no token", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("oauth-only@example.com");

    await db
      .update(userAuthProviders)
      .set({ passwordHash: "" })
      .where(
        and(
          eq(userAuthProviders.userId, userId),
          eq(userAuthProviders.provider, "email")
        )
      );

    const result = await passwordResetService.request("oauth-only@example.com");

    expect(result.message).toContain("a reset link was sent");

    const tokens = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    expect(tokens).toHaveLength(0);
  });

  test("replaces a stale token rather than stacking a second row for the same user", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();

    await passwordResetService.request("reset@example.com");
    await passwordResetService.request("reset@example.com");

    const tokens = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    expect(tokens).toHaveLength(1);
  });

  test("normalizes the email before lookup (mixed case still resolves)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("CaseSensitive@Example.com");

    await passwordResetService.request("casesensitive@EXAMPLE.com");

    const tokens = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    expect(tokens).toHaveLength(1);
  });
});

describe("PasswordResetService.complete", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("updates the password, deletes the token, and revokes every session", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();

    await sessionService.create(userId);
    await sessionService.create(userId);

    const sessionsBefore = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, userId));

    expect(sessionsBefore.length).toBeGreaterThanOrEqual(2);

    const rawToken = await seedResetToken(userId);
    const result = await passwordResetService.complete(rawToken, NEW_PASSWORD);

    expect(result.message).toBe("Password updated successfully");

    const tokens = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    expect(tokens).toHaveLength(0);

    const provider = await db.query.userAuthProviders.findFirst({
      where: and(
        eq(userAuthProviders.userId, userId),
        eq(userAuthProviders.provider, "email")
      ),
    });

    expect(provider).not.toBeUndefined();
    expect(
      await passwordService.verify(NEW_PASSWORD, provider?.passwordHash ?? "")
    ).toBe(true);
    expect(
      await passwordService.verify(PASSWORD, provider?.passwordHash ?? "")
    ).toBe(false);

    const sessions = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, userId));

    expect(sessions).toHaveLength(0);
  });

  test("rejects an unknown token with a 400 ApiError", async () => {
    if (!(await requireDb())) {
      return;
    }

    let caught: unknown;

    try {
      await passwordResetService.complete("00".repeat(32), NEW_PASSWORD);
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.statusCode).toBe(400);
    }
  });

  test("rejects an expired token with a 400 ApiError", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const rawToken = await seedResetToken(userId, RESET_TTL_EXPIRED());

    let caught: unknown;

    try {
      await passwordResetService.complete(rawToken, NEW_PASSWORD);
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.statusCode).toBe(400);
    }

    const tokens = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    expect(tokens).toHaveLength(1);
  });

  test("rejects when the user has no email-provider row (OAuth-only)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("oauth-only-complete@example.com");
    const rawToken = await seedResetToken(userId);

    await db
      .delete(userAuthProviders)
      .where(eq(userAuthProviders.userId, userId));

    let caught: unknown;

    try {
      await passwordResetService.complete(rawToken, NEW_PASSWORD);
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.statusCode).toBe(400);
    }

    const tokens = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    expect(tokens).toHaveLength(1);
  });
});
