import { describe, expect, it } from "vitest";

import type { IUser } from "@/features/auth/Auth.types";

import { displayName } from "./display-name";

function user(overrides: Partial<IUser> = {}): IUser {
  return {
    id: "u1",
    email: "person@example.com",
    firstName: "",
    lastName: "",
    emailVerified: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides
  };
}

describe("displayName", () => {
  it("returns first + last when both are set", () => {
    expect(displayName(user({ firstName: "Ada", lastName: "Lovelace" }))).toBe(
      "Ada Lovelace"
    );
  });

  it("returns just the first name when last is empty", () => {
    expect(displayName(user({ firstName: "Ada", lastName: "" }))).toBe("Ada");
  });

  it("falls back to email when both name fields are empty (OAuth or skipped profile)", () => {
    expect(displayName(user({ firstName: "", lastName: "" }))).toBe(
      "person@example.com"
    );
  });
});
