import { beforeEach, describe, expect, test } from "bun:test";

import { membershipMemo } from "../../src/middleware/require-active-membership.memo";
import type { ActiveMembership } from "../../src/middleware/require-active-membership.types";

const TTL_MS = 30_000;
const SWEEP_EVERY_WRITES = 1024;

const makeMembership = (accountId: string): ActiveMembership => ({
  id: `membership-${accountId}`,
  userId: "user-1",
  accountId,
  role: "member",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  revokedAt: null,
  revokedReason: null,
  invitedByUserId: null,
  joinedAt: "2026-01-01T00:00:00.000Z",
});

describe("membershipMemo sweep", () => {
  beforeEach(() => {
    membershipMemo.clearForTests();
  });

  test("read() lazily evicts an expired entry for its own key", () => {
    membershipMemo.write("u1", "a1", makeMembership("a1"), 0);

    expect(membershipMemo.read("u1", "a1", TTL_MS + 1)).toBeNull();
    expect(membershipMemo.sizeForTests()).toBe(0);
  });

  test("periodic sweep drops expired entries for keys never re-read", () => {
    const staleAt = 0;
    const later = TTL_MS + 1_000;

    membershipMemo.write("stale-1", "a", makeMembership("a"), staleAt);
    membershipMemo.write("stale-2", "a", makeMembership("a"), staleAt);

    /*
     * Fill up to one write below the sweep threshold — the two stale
     * entries must still be present (no sweep yet), then the next
     * write crosses the threshold and sweeps them.
     */
    for (let i = 0; i < SWEEP_EVERY_WRITES - 3; i++) {
      membershipMemo.write(
        `fresh-${String(i)}`,
        "a",
        makeMembership("a"),
        later
      );
    }

    expect(membershipMemo.sizeForTests()).toBe(SWEEP_EVERY_WRITES - 1);

    membershipMemo.write("fresh-final", "a", makeMembership("a"), later);

    /*
     * Sweep fired on the threshold write: the two staleAt entries are
     * gone; every fresh entry (including the final one) survives.
     */
    expect(membershipMemo.sizeForTests()).toBe(SWEEP_EVERY_WRITES - 2);
    expect(membershipMemo.read("stale-1", "a", later)).toBeNull();
    expect(membershipMemo.read("fresh-0", "a", later)).not.toBeNull();
  });
});
