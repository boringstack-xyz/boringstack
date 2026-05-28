import { describe, expect, test } from "bun:test";

import { toPublicUserProfile } from "../../../src/api/users/users.utils";
import type { IUser } from "../../../src/api/users/users.types";

const makeUser = (overrides: Partial<IUser> = {}): IUser => ({
  id: "u-1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  emailVerifiedAt: "2026-05-17T00:00:00.000Z",
  isPlatformAdmin: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-06-01T12:00:00.000Z",
  mfaEnabledAt: null,
  mfaSecretEncrypted: null,
  mfaLastTotpStep: null,
  ...overrides,
});

describe("toPublicUserProfile", () => {
  test("maps all public profile fields from IUser", () => {
    const user = makeUser();
    const result = toPublicUserProfile(user);

    expect(result.id).toBe("u-1");
    expect(result.email).toBe("jane@example.com");
    expect(result.firstName).toBe("Jane");
    expect(result.lastName).toBe("Doe");
    expect(result.emailVerified).toBe(true);
    expect(result.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.updatedAt).toBe("2026-06-01T12:00:00.000Z");
  });

  test("emailVerified is false when emailVerifiedAt is null", () => {
    const user = makeUser({ emailVerifiedAt: null });
    const result = toPublicUserProfile(user);

    expect(result.emailVerified).toBe(false);
  });

  test("does NOT leak internal fields", () => {
    const user = makeUser();
    const result = toPublicUserProfile(user);

    expect("isPlatformAdmin" in result).toBe(false);
    expect("passwordHash" in result).toBe(false);
  });
});
