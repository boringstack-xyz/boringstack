import { now } from "@/lib/time/now";

import type { IUser } from "@/features/auth/Auth.types";

/**
 * Build a valid `IUser` for tests and Storybook decorators —
 * anywhere you need a user payload that passes Zod validation.
 *
 * Pass `overrides` to vary the shape without redeclaring every field:
 *
 *   makeUser()                              // demo defaults
 *   makeUser({ email: "x@y.com" })         // custom email
 *
 * Sequence-suffix counter (`__counter`) makes each call produce a unique
 * UUID-ish id when you need several distinct users in one test.
 */
let __counter = 0;

export function makeUser(overrides: Partial<IUser> = {}): IUser {
  __counter += 1;
  const suffix = __counter.toString(16).padStart(12, "0");

  return {
    id: `f47ac10b-58cc-4372-a567-${suffix}`,
    email: "demo@example.com",
    firstName: "Demo",
    lastName: "User",
    emailVerified: true,
    createdAt: now(),
    updatedAt: now(),
    ...overrides
  };
}

/**
 * Reset the internal counter — useful in `beforeEach` if you depend on the
 * generated ids being predictable across tests.
 */
export function resetUserFactory(): void {
  __counter = 0;
}
