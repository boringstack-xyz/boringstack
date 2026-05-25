import { describe, expect, test } from "bun:test";
import {
  isRetryableError,
  retryWithBackoff,
} from "../../../src/lib/email/email.utils";

describe("isRetryableError", () => {
  test("non-Error → false", () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError("oops")).toBe(false);
    expect(isRetryableError({ message: "x" })).toBe(false);
  });

  test("network/timeout errors → true", () => {
    expect(isRetryableError(new Error("network ETIMEDOUT"))).toBe(true);
    expect(isRetryableError(new Error("connection refused"))).toBe(true);
    const entry = new Error("fail");

    entry.name = "TimeoutError";
    expect(isRetryableError(entry)).toBe(true);
  });

  test("HTTP 429 / 503 messages → true", () => {
    expect(isRetryableError(new Error("rate limit (429)"))).toBe(true);
    expect(isRetryableError(new Error("503 service unavailable"))).toBe(true);
  });

  test("plain Error with non-transient message → false", () => {
    expect(isRetryableError(new Error("invalid token"))).toBe(false);
  });

  test("custom retryable error type whitelist", () => {
    class MyTransient extends Error {}
    expect(isRetryableError(new MyTransient(), [MyTransient])).toBe(true);
    expect(isRetryableError(new Error("invalid"), [MyTransient])).toBe(false);
  });
});

describe("retryWithBackoff", () => {
  test("returns immediately on success", async () => {
    let calls = 0;
    const result = await retryWithBackoff(() => {
      calls++;

      return Promise.resolve("ok");
    });

    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  test("retries transient errors then succeeds", async () => {
    let calls = 0;
    const result = await retryWithBackoff(
      () => {
        calls++;

        if (calls < 3) {
          throw new Error("network down");
        }

        return Promise.resolve("ok");
      },
      { maxRetries: 5, retryDelayMs: 1 }
    );

    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  test("does not retry non-transient errors", async () => {
    let calls = 0;
    let caught: unknown;

    try {
      await retryWithBackoff(
        (): Promise<string> => {
          calls++;

          throw new Error("bad request");
        },
        { maxRetries: 5, retryDelayMs: 1 }
      );
    } catch (err: unknown) {
      caught = err;
    }

    expect(caught instanceof Error).toBe(true);

    if (caught instanceof Error) {
      expect(caught.message).toBe("bad request");
    }

    expect(calls).toBe(1);
  });

  test("throws last error after exhausting retries", async () => {
    let calls = 0;
    let caught: unknown;

    try {
      await retryWithBackoff(
        (): Promise<string> => {
          calls++;

          throw new Error("network jitter");
        },
        { maxRetries: 2, retryDelayMs: 1 }
      );
    } catch (err: unknown) {
      caught = err;
    }

    expect(caught instanceof Error).toBe(true);

    if (caught instanceof Error) {
      expect(caught.message).toBe("network jitter");
    }

    // 1 initial attempt + 2 retries = 3 calls
    expect(calls).toBe(3);
  });
});
