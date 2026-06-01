import { beforeEach, describe, expect, test } from "bun:test";
import { authService } from "../../../../src/api/auth/services";
import { ApiError } from "../../../../src/lib/errors";
import { passwordService } from "../../../../src/lib/password";
import { seedPendingUser, seedVerifiedUser } from "../../../helpers/auth";
import {
  accountMemberships,
  accounts,
  cleanDatabase,
  db,
  emailVerificationTokens,
  eq,
  requireDb,
  userAuthProviders,
  users,
} from "../../../helpers/db";

const VALID_PASSWORD = "Hunter2!";

describe("AuthService.register", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("creates a pending user + hash + verification token, NO account, NO membership", async () => {
    if (!(await requireDb())) {
      return;
    }

    const result = await authService.register({
      email: "Jane@Example.com",
      password: VALID_PASSWORD,
      firstName: "Jane",
      lastName: "Doe",
    });

    expect(result.email).toBe("jane@example.com");

    const persisted = await db.query.users.findFirst({
      where: eq(users.email, "jane@example.com"),
    });

    expect(persisted).not.toBeUndefined();
    expect(persisted?.emailVerifiedAt).toBeNull();
    expect(persisted?.firstName).toBe("Jane");

    if (!persisted) {
      return;
    }

    const provider = await db.query.userAuthProviders.findFirst({
      where: eq(userAuthProviders.userId, persisted.id),
    });

    expect(provider).not.toBeUndefined();
    expect(provider?.provider).toBe("email");
    expect(provider?.passwordHash).not.toBe(VALID_PASSWORD);
    expect(
      await passwordService.verify(VALID_PASSWORD, provider?.passwordHash ?? "")
    ).toBe(true);

    const tokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, persisted.id));

    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.tokenHash).toHaveLength(64);

    const accountRows = await db.select().from(accounts);

    expect(accountRows).toHaveLength(0);

    const membershipRows = await db.select().from(accountMemberships);

    expect(membershipRows).toHaveLength(0);
  });

  test("rejects a duplicate email with a 409 ApiError", async () => {
    if (!(await requireDb())) {
      return;
    }

    await authService.register({
      email: "dup@example.com",
      password: VALID_PASSWORD,
    });

    let caught: unknown;

    try {
      await authService.register({
        email: "dup@example.com",
        password: VALID_PASSWORD,
      });
    } catch (err: unknown) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.statusCode).toBe(409);
    }
  });
});

describe("AuthService.login", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("succeeds with the correct password for a verified user", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedVerifiedUser({
      email: "login@example.com",
      password: VALID_PASSWORD,
    });

    const result = await authService.login({
      email: "login@example.com",
      password: VALID_PASSWORD,
    });

    expect(result.mfaRequired).toBe(false);

    if (!result.mfaRequired) {
      expect(result.user.email).toBe("login@example.com");
    }
  });

  test("rejects an unknown email with INVALID_CREDENTIALS", async () => {
    if (!(await requireDb())) {
      return;
    }

    let caught: unknown;

    try {
      await authService.login({
        email: "unknown@example.com",
        password: VALID_PASSWORD,
      });
    } catch (err: unknown) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (!(caught instanceof ApiError)) {
      return;
    }

    expect(caught.statusCode).toBe(401);
    expect(caught.code).toBe("INVALID_CREDENTIALS");
  });

  test("rejects a wrong password without leaking which field was wrong", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedVerifiedUser({
      email: "wrongpw@example.com",
      password: VALID_PASSWORD,
    });

    let caught: unknown;

    try {
      await authService.login({
        email: "wrongpw@example.com",
        password: "WrongPass1",
      });
    } catch (err: unknown) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.code).toBe("INVALID_CREDENTIALS");
    }
  });

  test("rejects a pending user (correct password, email not verified) with EMAIL_NOT_VERIFIED", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedPendingUser({
      email: "pending@example.com",
      password: VALID_PASSWORD,
    });

    let caught: unknown;

    try {
      await authService.login({
        email: "pending@example.com",
        password: VALID_PASSWORD,
      });
    } catch (err: unknown) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (!(caught instanceof ApiError)) {
      return;
    }

    expect(caught.statusCode).toBe(403);
    expect(caught.code).toBe("EMAIL_NOT_VERIFIED");
  });

  test("EMAIL_NOT_VERIFIED only fires AFTER correct password (no enumeration on pending users)", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedPendingUser({
      email: "stealth@example.com",
      password: VALID_PASSWORD,
    });

    let caught: unknown;

    try {
      await authService.login({
        email: "stealth@example.com",
        password: "WrongPass1",
      });
    } catch (err: unknown) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.code).toBe("INVALID_CREDENTIALS");
    }
  });
});
