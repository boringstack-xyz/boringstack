import { beforeEach, describe, expect, test } from "bun:test";

import { resolveOperator } from "../../src/boot/operator";
import { BootInvariantError } from "../../src/boot/invariants";
import { seedVerifiedUser } from "../helpers/auth";
import { cleanDatabase, requireDb } from "../helpers/db";

const makeUser = async (
  email: string,
  isPlatformAdmin: boolean
): Promise<string> => {
  const { user } = await seedVerifiedUser({
    email,
    password: "Hunter2Strong!",
    firstName: "Op",
    lastName: "Test",
    isPlatformAdmin,
  });

  return user.id;
};

/* Resolves with the error a promise rejects with; fails the test if it resolves. */
const rejectionOf = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("expected the promise to reject");
};

describe("resolveOperator", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("resolves the single platform admin", async () => {
    if (!(await requireDb())) {
      return;
    }

    const id = await makeUser("operator@example.com", true);

    await makeUser("member@example.com", false);

    expect(await resolveOperator("")).toEqual({ id });
  });

  test("refuses to boot when there is no platform admin", async () => {
    if (!(await requireDb())) {
      return;
    }

    await makeUser("member@example.com", false);

    expect(await rejectionOf(resolveOperator(""))).toBeInstanceOf(
      BootInvariantError
    );
  });

  test("refuses to guess when several platform admins exist and none is pinned", async () => {
    if (!(await requireDb())) {
      return;
    }

    await makeUser("first@example.com", true);
    await makeUser("second@example.com", true);

    expect(await rejectionOf(resolveOperator(""))).toBeInstanceOf(
      BootInvariantError
    );
  });

  test("honours a pinned operator and refuses a pin that is not a platform admin", async () => {
    if (!(await requireDb())) {
      return;
    }

    const pinned = await makeUser("pinned@example.com", true);
    const other = await makeUser("other@example.com", false);

    expect(await resolveOperator(pinned)).toEqual({ id: pinned });
    expect(await rejectionOf(resolveOperator(other))).toBeInstanceOf(
      BootInvariantError
    );
  });
});
