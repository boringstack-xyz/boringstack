import { describe, expect, test } from "bun:test";

import { toJoinRequest } from "../../../src/api/accounts/join-requests.utils";

describe("toJoinRequest", () => {
  const baseRow = {
    id: "11111111-1111-1111-1111-111111111111",
    accountId: "22222222-2222-2222-2222-222222222222",
    userId: "33333333-3333-3333-3333-333333333333",
    email: "requester@acme.test",
    status: "pending",
    createdAt: "2026-05-27T00:00:00.000Z",
    decidedAt: null,
    decidedByUserId: null,
  };

  test("passes through valid pending row unchanged", () => {
    expect(toJoinRequest(baseRow)).toEqual({
      id: baseRow.id,
      accountId: baseRow.accountId,
      userId: baseRow.userId,
      email: baseRow.email,
      status: "pending",
      createdAt: baseRow.createdAt,
      decidedAt: null,
      decidedByUserId: null,
    });
  });

  test("recognises approved status", () => {
    const mapped = toJoinRequest({
      ...baseRow,
      status: "approved",
      decidedAt: "2026-05-27T01:00:00.000Z",
      decidedByUserId: "deciding-user",
    });

    expect(mapped.status).toBe("approved");
    expect(mapped.decidedAt).toBe("2026-05-27T01:00:00.000Z");
    expect(mapped.decidedByUserId).toBe("deciding-user");
  });

  test("recognises denied status", () => {
    expect(
      toJoinRequest({
        ...baseRow,
        status: "denied",
        decidedAt: "2026-05-27T02:00:00.000Z",
      }).status
    ).toBe("denied");
  });

  test("falls back to pending for an unknown status string", () => {
    expect(toJoinRequest({ ...baseRow, status: "garbage" }).status).toBe(
      "pending"
    );
  });
});
