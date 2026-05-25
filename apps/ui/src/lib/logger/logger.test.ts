import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "./logger";

describe("logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation((): void => undefined);
    errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation((): void => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("emits the event field at info level", () => {
    logger.info({ event: "auth.login_success", userId: "u1" });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const entry = logSpy.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(entry.event).toBe("auth.login_success");
    expect(entry.userId).toBe("u1");
    expect(entry.level).toBe("info");
    expect(typeof entry.timestamp).toBe("string");
  });

  it("routes error level to console.error", () => {
    logger.error({ event: "ui.error_boundary" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("redacts password / token / authorization at any depth", () => {
    logger.info({
      event: "auth.attempt",
      password: "hunter2",
      token: "jwt-abc",
      authorization: "Bearer xyz",
      meta: { apiKey: "secret", nested: { refreshToken: "rt" } }
    });
    const entry = logSpy.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(entry.password).toBe("[redacted]");
    expect(entry.token).toBe("[redacted]");
    expect(entry.authorization).toBe("[redacted]");
    const meta = entry.meta as Record<string, unknown>;

    expect(meta.apiKey).toBe("[redacted]");
    const nested = meta.nested as Record<string, unknown>;

    expect(nested.refreshToken).toBe("[redacted]");
  });

  it("does not redact harmless keys", () => {
    logger.info({ event: "auth.attempt", username: "alice", count: 3 });
    const entry = logSpy.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(entry.username).toBe("alice");
    expect(entry.count).toBe(3);
  });

  it("masks arrays of PII payloads", () => {
    logger.info({
      event: "auth.attempt",
      attempts: [{ password: "a" }, { password: "b" }]
    });
    const entry = logSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    const attempts = entry.attempts as Record<string, unknown>[];

    expect(attempts[0]?.password).toBe("[redacted]");
    expect(attempts[1]?.password).toBe("[redacted]");
  });
});
