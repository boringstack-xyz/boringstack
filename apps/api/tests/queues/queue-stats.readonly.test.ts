import { describe, expect, test } from "bun:test";

import {
  getQueueStatsReadOnly,
  readOnlyQueueNames,
  type QueueOpener,
} from "../../src/queues/queue-stats.readonly";
import type { IManagedQueue } from "../../src/queues/queue-manager";

const fakeQueue = (
  name: string,
  counts: Record<string, number>
): IManagedQueue => ({
  name,
  getJobCounts: () => Promise.resolve(counts),
  close: () => Promise.resolve(),
});

describe("readOnlyQueueNames", () => {
  test("omits web push unless it is configured", () => {
    expect(readOnlyQueueNames(false)).not.toContain("web-push-delivery");
    expect(readOnlyQueueNames(true)).toContain("web-push-delivery");
  });
});

describe("getQueueStatsReadOnly", () => {
  test("opens one plain handle per queue name and maps its job counts", async () => {
    const opened: string[] = [];

    const open: QueueOpener = (name) => {
      opened.push(name);

      return fakeQueue(name, { waiting: 2, failed: 1, completed: 9 });
    };

    const stats = await getQueueStatsReadOnly({
      open,
      includeWebPush: false,
    });

    expect(opened).toEqual(readOnlyQueueNames(false));
    expect(stats.map((stat) => stat.name)).toEqual(readOnlyQueueNames(false));
    expect(stats[0]?.counts).toEqual({
      waiting: 2,
      active: 0,
      completed: 9,
      failed: 1,
      delayed: 0,
      paused: 0,
    });
  });

  test("never names a worker or scheduler: only the queue-stats surface is touched", async () => {
    const seen: string[] = [];

    const open: QueueOpener = (name) => {
      const queue = fakeQueue(name, {});

      return {
        ...queue,
        getJobCounts: (...states) => {
          seen.push(...states);

          return Promise.resolve({});
        },
      };
    };

    await getQueueStatsReadOnly({ open, includeWebPush: false });

    expect(new Set(seen)).toEqual(
      new Set(["waiting", "active", "completed", "failed", "delayed", "paused"])
    );
  });
});
