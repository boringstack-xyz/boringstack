import { describe, expect, test } from "bun:test";

import {
  computeOwnershipTransferExpiresAt,
  isLiveOwnershipTransfer,
  toOwnershipTransfer,
} from "../../../src/api/accounts/ownership-transfers.utils";

const baseRow = {
  id: "11111111-1111-1111-1111-111111111111",
  accountId: "22222222-2222-2222-2222-222222222222",
  fromUserId: "33333333-3333-3333-3333-333333333333",
  toUserId: "44444444-4444-4444-4444-444444444444",
  tokenHash: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  expiresAt: "2026-12-31T00:00:00.000Z",
  acceptedAt: null,
  declinedAt: null,
  cancelledAt: null,
  createdAt: "2026-05-27T00:00:00.000Z",
  updatedAt: "2026-05-27T00:00:00.000Z",
};

describe("computeOwnershipTransferExpiresAt", () => {
  test("produces an ISO string a week in the future", () => {
    const value = computeOwnershipTransferExpiresAt();
    const parsed = Date.parse(value);

    expect(Number.isFinite(parsed)).toBe(true);

    const diff = parsed - Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    expect(diff).toBeLessThanOrEqual(oneWeek + 1000);
    expect(diff).toBeGreaterThan(oneWeek - 1000);
  });
});

describe("isLiveOwnershipTransfer", () => {
  test("true when none of the terminal timestamps are set", () => {
    expect(isLiveOwnershipTransfer(baseRow)).toBe(true);
  });

  test("false after acceptance", () => {
    expect(
      isLiveOwnershipTransfer({
        ...baseRow,
        acceptedAt: "2026-05-27T01:00:00.000Z",
      })
    ).toBe(false);
  });

  test("false after decline or cancel", () => {
    expect(
      isLiveOwnershipTransfer({
        ...baseRow,
        declinedAt: "2026-05-27T01:00:00.000Z",
      })
    ).toBe(false);
    expect(
      isLiveOwnershipTransfer({
        ...baseRow,
        cancelledAt: "2026-05-27T01:00:00.000Z",
      })
    ).toBe(false);
  });
});

describe("toOwnershipTransfer", () => {
  test("maps a pending row into the IOwnershipTransfer shape", () => {
    expect(toOwnershipTransfer(baseRow)).toEqual({
      id: baseRow.id,
      accountId: baseRow.accountId,
      fromUserId: baseRow.fromUserId,
      toUserId: baseRow.toUserId,
      expiresAt: baseRow.expiresAt,
      acceptedAt: null,
      declinedAt: null,
      cancelledAt: null,
      createdAt: baseRow.createdAt,
    });
  });
});
