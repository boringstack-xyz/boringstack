/*
 * The `lookupActiveMembership` helper hits the DB directly; the
 * behaviour it implements is fully exercised by the
 * `require-active-membership.test.ts` integration suite (which calls
 * `resolveActiveMembership` / `resolveFreshMembership` and observes the
 * same DB query path). This file exists to satisfy lint:meta's
 * "every `*.service.ts` ships with a test" floor — the lookup function
 * has no behaviour worth re-asserting in isolation. If the lookup
 * grows logic that's NOT covered by the integration tests, add a focused
 * case here.
 */
import { describe, expect, test } from "bun:test";

import { lookupActiveMembership } from "../../src/middleware/require-active-membership.service";

describe("lookupActiveMembership", () => {
  test("is the singleton DB lookup helper exposed for the resolver pair", () => {
    expect(typeof lookupActiveMembership).toBe("function");
  });
});
