import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

import { resolveFeatures } from "../../../src/lib/acl/feature-resolution";
import { resolveAccountFeatures } from "../../../src/lib/acl/resolve-account-features";
import { requireDb } from "../../helpers/db";

/*
 * Integration test (skips without a reachable Postgres, mirroring
 * audit-log.service.test.ts). An account id with no plan row and no
 * overrides must resolve to exactly the same default feature map as
 * resolveFeatures([], []) — the DB wrapper adds data access, never
 * resolution semantics.
 */
describe("resolveAccountFeatures", () => {
  test("resolves an account without plan or overrides to the pure defaults", async () => {
    if (!(await requireDb())) {
      return;
    }

    const resolved = await resolveAccountFeatures(randomUUID());

    expect(resolved).toEqual(resolveFeatures([], []));
  });
});
