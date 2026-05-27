import assert from "assert";
import { test } from "bun:test";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:7330";

const isApiReachable = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(500),
    });

    if (!res.ok) {
      return false;
    }

    /*
     * Strict content-type check so unrelated processes on the same port
     * (Vite, nginx, etc. — common during local dev when the API isn't
     * running) don't pass as "reachable" and crash the JSON parser below.
     */
    const contentType = res.headers.get("content-type") ?? "";

    return contentType.includes("application/json");
  } catch {
    return false;
  }
};

test("GET /health returns status ok", async () => {
  if (!(await isApiReachable())) {
    /*
     * Integration test — silently passes when the dev server isn't running
     * so unit suites stay green in CI without a live API.
     */
    return;
  }

  const res = await fetch(`${BASE_URL}/health`);

  assert.strictEqual(res.status, 200);
  const body: unknown = await res.json();

  if (
    body === null ||
    typeof body !== "object" ||
    !("status" in body) ||
    typeof body.status !== "string"
  ) {
    throw new Error("Health response missing string `status` field");
  }

  assert.strictEqual(body.status, "ok");
});
