import { describe, expect, it } from "vitest";

import { loginInputSchema, userSchema } from "./Auth.schemas";

describe("loginInputSchema", () => {
  it("accepts a valid email + 8+ char password", () => {
    const result = loginInputSchema.safeParse({
      email: "a@b.com",
      password: "longenoughpw"
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed emails", () => {
    const result = loginInputSchema.safeParse({
      email: "not-an-email",
      password: "longenoughpw"
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    const emailIssue = result.error.issues.find((i) =>
      i.path.includes("email")
    );

    expect(emailIssue?.message).toMatch(/email/i);
  });

  it("rejects passwords under 8 chars", () => {
    const result = loginInputSchema.safeParse({
      email: "a@b.com",
      password: "short"
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(loginInputSchema.safeParse({}).success).toBe(false);
    expect(loginInputSchema.safeParse({ email: "a@b.com" }).success).toBe(
      false
    );
  });
});

describe("userSchema", () => {
  it("accepts a valid user payload", () => {
    expect(
      userSchema.safeParse({
        id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        email: "demo@example.com",
        firstName: "Demo",
        lastName: "User",
        emailVerified: true
      }).success
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(
      userSchema.safeParse({
        id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        email: "not-an-email",
        firstName: "Demo",
        lastName: "User",
        emailVerified: true
      }).success
    ).toBe(false);
  });

  it("does NOT include platform-admin status in the public user shape — that lives server-side only", () => {
    const result = userSchema.safeParse({
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      email: "demo@example.com",
      firstName: "Demo",
      lastName: "User",
      emailVerified: true
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).not.toHaveProperty("isPlatformAdmin");
    }
  });
});
