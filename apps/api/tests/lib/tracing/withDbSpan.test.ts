import { describe, expect, test } from "bun:test";

import { withDbSpan } from "../../../src/lib/tracing/withDbSpan";

/*
 * No OTel SDK is registered in tests, so the tracer is the API's no-op
 * implementation — which is exactly the contract worth locking: the
 * wrapper must be transparent (results pass through, rejections
 * re-throw unchanged) whether or not a real exporter is wired up.
 */
describe("withDbSpan", () => {
  test("returns the handler's resolved value", async () => {
    const result = await withDbSpan(
      "users.findById",
      { "db.statement": "select 1" },
      () => Promise.resolve({ id: "u1" })
    );

    expect(result).toEqual({ id: "u1" });
  });

  test("re-throws the handler's rejection unchanged", async () => {
    const boom = new Error("query failed");
    let caught: unknown;

    try {
      await withDbSpan("users.findById", {}, () => Promise.reject(boom));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(boom);
  });
});
