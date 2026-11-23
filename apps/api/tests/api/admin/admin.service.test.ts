import { describe, expect, test } from "bun:test";

import { AdminService } from "../../../src/api/admin/admin.service";
import { ApiError } from "../../../src/lib/errors";

const EMPTY_COUNTS = {
  waiting: 0,
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
  paused: 0,
};

describe("AdminService.getQueueStats", () => {
  test("returns what the read-only reader returns", async () => {
    const service = new AdminService(() =>
      Promise.resolve([{ name: "email-delivery", counts: EMPTY_COUNTS }])
    );

    expect(await service.getQueueStats()).toEqual([
      { name: "email-delivery", counts: EMPTY_COUNTS },
    ]);
  });

  test("maps a failing reader to an external-service ApiError", async () => {
    const service = new AdminService(() =>
      Promise.reject(new Error("valkey unreachable"))
    );

    let captured: unknown;

    try {
      await service.getQueueStats();
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(ApiError);
  });
});
