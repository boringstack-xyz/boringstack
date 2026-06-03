import { describe, expect, test } from "bun:test";
import type { Job } from "bullmq";

import { withQueueSpan } from "../../../src/lib/tracing/withQueueSpan";

/*
 * The wrapper only reads `id`, `name`, and `attemptsMade` off the job —
 * its parameter is typed as exactly that Pick, so a structural stub
 * keeps the test independent of a Redis-backed queue. The contract
 * under test is transparency: results pass through and rejections
 * re-throw so BullMQ's retry semantics see the failure exactly as
 * before.
 */
type JobStub = Pick<Job, "id" | "name" | "attemptsMade">;

const makeJob = (overrides: Partial<JobStub> = {}): JobStub => ({
  id: "job-1",
  name: "send-email",
  attemptsMade: 0,
  ...overrides,
});

describe("withQueueSpan", () => {
  test("returns the handler's resolved value", async () => {
    const result = await withQueueSpan("email-delivery", makeJob(), () =>
      Promise.resolve("delivered")
    );

    expect(result).toBe("delivered");
  });

  test("re-throws the handler's rejection unchanged", async () => {
    const boom = new Error("processor failed");
    let caught: unknown;

    try {
      await withQueueSpan("email-delivery", makeJob(), () =>
        Promise.reject(boom)
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(boom);
  });

  test("tolerates a job without an id (messaging.message.id falls back)", async () => {
    const result = await withQueueSpan(
      "email-delivery",
      makeJob({ id: undefined }),
      () => Promise.resolve("ok")
    );

    expect(result).toBe("ok");
  });
});
