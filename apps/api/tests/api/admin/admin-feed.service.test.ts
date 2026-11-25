import { beforeEach, describe, expect, test } from "bun:test";

import { AdminFeedService } from "../../../src/api/admin/admin-feed.service";
import { cleanDatabase, requireDb } from "../../helpers/db";

const queue = (failed: number) => [
  {
    name: "email-delivery",
    counts: {
      waiting: 0,
      active: 0,
      completed: 0,
      failed,
      delayed: 0,
      paused: 0,
    },
  },
];

const KEY = "queue-failed:email-delivery";

describe("AdminFeedService", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("lists a queue with failed jobs, and resolve hides it until more fail", async () => {
    if (!(await requireDb())) {
      return;
    }

    let failed = 2;
    const service = new AdminFeedService(() => Promise.resolve(queue(failed)));

    expect(await service.list()).toEqual([
      { key: KEY, title: "Failed jobs in email-delivery", count: 2 },
    ]);

    await service.resolve(KEY, "00000000-0000-4000-8000-000000000001");

    expect(await service.list()).toEqual([]);

    failed = 3;

    expect(await service.list()).toHaveLength(1);
  });

  test("snooze hides the item until the snooze has run out", async () => {
    if (!(await requireDb())) {
      return;
    }

    const service = new AdminFeedService(() => Promise.resolve(queue(1)));

    const until = await service.snooze(
      KEY,
      2,
      "00000000-0000-4000-8000-000000000001"
    );

    expect(Date.parse(until)).toBeGreaterThan(Date.now());
    expect(await service.list()).toEqual([]);
  });

  test("snooze refuses hours outside 1 to 168", async () => {
    if (!(await requireDb())) {
      return;
    }

    const service = new AdminFeedService(() => Promise.resolve(queue(1)));

    let thrown: unknown = null;

    try {
      await service.snooze(KEY, 0, "00000000-0000-4000-8000-000000000001");
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
  });
});
