import { beforeEach, describe, expect, test } from "bun:test";

import { passwordChangeService } from "../../../../src/api/auth/services/password-change.service";
import { ApiError } from "../../../../src/lib/errors";
import { passwordService } from "../../../../src/lib/password";
import { seedVerifiedUser } from "../../../helpers/auth";
import {
  and,
  cleanDatabase,
  db,
  eq,
  requireDb,
  userAuthProviders,
} from "../../../helpers/db";

const PASSWORD = "Hunter2Strong!";
const NEW_PASSWORD = "EvenStronger3!";

describe("PasswordChangeService.change", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("updates the password hash when the current password is correct", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user } = await seedVerifiedUser({
      email: "change@example.com",
      password: PASSWORD,
    });

    const result = await passwordChangeService.change(
      user.id,
      PASSWORD,
      NEW_PASSWORD
    );

    expect(result.message).toContain("updated");

    const [provider] = await db
      .select()
      .from(userAuthProviders)
      .where(
        and(
          eq(userAuthProviders.userId, user.id),
          eq(userAuthProviders.provider, "email")
        )
      );

    expect(provider).toBeDefined();

    if (provider === undefined) {
      throw new Error("Expected email auth provider");
    }

    expect(
      await passwordService.verify(NEW_PASSWORD, provider.passwordHash)
    ).toBe(true);
  });

  test("rejects an incorrect current password", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user } = await seedVerifiedUser({
      email: "wrong@example.com",
      password: PASSWORD,
    });

    let caught: unknown;

    try {
      await passwordChangeService.change(user.id, "WrongPass1!", NEW_PASSWORD);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.statusCode).toBe(400);
    }
  });
});
