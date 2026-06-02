import { describe, expect, test } from "bun:test";

import { getQueueManager } from "../../../src/config/setup/setup-queues";

/*
 * setupQueues() itself constructs real BullMQ queues + workers against
 * Valkey and registers repeatable jobs — that boot path is exercised
 * end-to-end by infra/compose full-stack-smoke. What unit tests can pin
 * down is the accessor contract callers rely on for inline fallback.
 */
describe("getQueueManager", () => {
  test("returns null before setupQueues() has run (inline-fallback contract)", () => {
    expect(getQueueManager()).toBe(null);
  });
});
