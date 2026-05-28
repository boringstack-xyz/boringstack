import { describe, expect, test } from "bun:test";

import { toPublicUser } from "../../../src/api/auth/auth.utils";
import type { IUser } from "../../../src/api/users/users.types";

const makeUser = (overrides: Partial<IUser> = {}): IUser => ({
  id: "u-1",
  email: "Jane.Doe@Example.com",
  firstName: "Jane",
  lastName: "Doe",
  emailVerifiedAt: "2026-05-17T00:00:00.000Z",
  isPlatformAdmin: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
  mfaEnabledAt: null,
  mfaSecretEncrypted: null,
  mfaLastTotpStep: null,
  ...overrides,
});

describe("toPublicUser", () => {
  test("maps all public fields from IUser to IPublicUser", () => {
    const user = makeUser();
    const result = toPublicUser(user);

    expect(result.id).toBe("u-1");
    expect(result.email).toBe("Jane.Doe@Example.com");
    expect(result.firstName).toBe("Jane");
    expect(result.lastName).toBe("Doe");
    expect(result.emailVerified).toBe(true);
  });

  test("emailVerified is false when emailVerifiedAt is null", () => {
    const user = makeUser({ emailVerifiedAt: null });
    const result = toPublicUser(user);

    expect(result.emailVerified).toBe(false);
  });

  test("does NOT expose isPlatformAdmin or other internal fields", () => {
    const user = makeUser();
    const result = toPublicUser(user);

    expect("isPlatformAdmin" in result).toBe(false);
    expect("passwordHash" in result).toBe(false);
  });
});
