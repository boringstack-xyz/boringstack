import { describe, expect, test } from "bun:test";

import {
  byTime,
  isHealthProbe,
  levelOf,
  matchesFilter,
  messageSignature,
  parseLogLine,
  scrubMessage,
  sinceTime,
  summarizeRecords,
  type ILogRecord,
} from "./logs.utils";

const record = (overrides: Partial<ILogRecord>): ILogRecord => ({
  time: "2026-11-23T10:00:00.000000000Z",
  service: "api",
  level: "info",
  message: "ok",
  event: null,
  requestId: null,
  ...overrides,
});

describe("reading log lines", () => {
  test("the API's JSON lines read level, message, event and request id", () => {
    const line =
      '2026-11-23T10:00:01.123456789Z {"level":"ERROR","time":1763892001123,"event":"auth_failed","requestId":"req-1","msg":"Sign-in failed for ada@example.com"}';

    expect(parseLogLine(line, "api")).toEqual({
      time: "2026-11-23T10:00:01.123456789Z",
      service: "api",
      level: "error",
      message: "Sign-in failed for ada@example.com",
      event: "auth_failed",
      requestId: "req-1",
    });
  });

  test("plain text reads its level from its words", () => {
    expect(
      parseLogLine("2026-11-23T10:00:00Z Database connection failed", "api")
        ?.level
    ).toBe("error");
    expect(
      parseLogLine("2026-11-23T10:00:00Z warning: slow", "api")?.level
    ).toBe("warn");
    expect(parseLogLine("2026-11-23T10:00:00Z started", "api")?.level).toBe(
      "info"
    );
  });

  test("a quoted name is not a level: SQL printed by a migration", () => {
    expect(
      parseLogLine('2026-11-23T10:00:00Z \t"error" text,', "api-migrate")?.level
    ).toBe("info");
    expect(
      parseLogLine('2026-11-23T10:00:00Z insert into "jobs" failed', "api")
        ?.level
    ).toBe("error");
  });

  test("a line without Docker's timestamp is not a record", () => {
    expect(parseLogLine("  at handler (file.ts:1)", "api")).toBeNull();
  });

  test("level names and numbers map to four levels", () => {
    expect(levelOf("WARNING")).toBe("warn");
    expect(levelOf("fatal")).toBe("error");
    expect(levelOf("50")).toBe("error");
    expect(levelOf("nope")).toBeNull();
  });
});

describe("since, filters and probes", () => {
  test("since takes a duration or a time", () => {
    const now = Date.parse("2026-11-23T10:30:00Z");

    expect(sinceTime("15m", now)?.toISOString()).toBe(
      "2026-11-23T10:15:00.000Z"
    );
    expect(sinceTime("2h", now)?.toISOString()).toBe(
      "2026-11-23T08:30:00.000Z"
    );
    expect(sinceTime("2026-11-23T09:00:00Z", now)?.toISOString()).toBe(
      "2026-11-23T09:00:00.000Z"
    );
    expect(sinceTime("soon", now)).toBeNull();
  });

  test("records filter by level and by request id", () => {
    const found = record({ level: "error", requestId: "req-9", message: "x" });

    expect(matchesFilter(found, { minLevel: "error", requestId: null })).toBe(
      true
    );
    expect(
      matchesFilter(found, { minLevel: "error", requestId: "req-9" })
    ).toBe(true);
    expect(
      matchesFilter(found, { minLevel: "error", requestId: "req-1" })
    ).toBe(false);
    expect(
      matchesFilter(record({ level: "info" }), {
        minLevel: "error",
        requestId: null,
      })
    ).toBe(false);
  });

  test("health probes are left out of the listing", () => {
    expect(isHealthProbe(record({ message: "GET /health 200" }))).toBe(true);
    expect(isHealthProbe(record({ message: "GET /api/v1/accounts 200" }))).toBe(
      false
    );
  });

  test("records are in time order", () => {
    const ordered = byTime([
      record({ time: "2026-11-23T10:00:02Z", message: "second" }),
      record({ time: "2026-11-23T10:00:01.5Z", message: "first" }),
    ]);

    expect(ordered.map((entry) => entry.message)).toEqual(["first", "second"]);
  });
});

describe("summaries", () => {
  test("messages keep their shape, not their ids, numbers or quoted values", () => {
    expect(
      messageSignature(
        'Failed for "Ada Lovelace" with id 3f2504e0-4f89-11d3-9a0c-0305e82c3301 after 12 tries'
      )
    ).toBe("Failed for <str> with id <id> after <n> tries");
  });

  test("emails are scrubbed from examples", () => {
    expect(scrubMessage("no account for ada@example.com")).toBe(
      "no account for <email>"
    );
  });

  test("errors group by service, event and shape, most frequent first", () => {
    const summary = summarizeRecords([
      record({
        level: "error",
        message: "timeout after 10 ms",
        event: "db",
        time: "2026-11-23T10:00:00Z",
      }),
      record({
        level: "error",
        message: "timeout after 20 ms",
        event: "db",
        time: "2026-11-23T10:00:05Z",
      }),
      record({
        level: "error",
        message: "other failure",
        event: null,
        time: "2026-11-23T10:00:06Z",
      }),
      record({ level: "info", message: "fine" }),
    ]);

    expect(summary.counts.api).toEqual({
      debug: 0,
      info: 1,
      warn: 0,
      error: 3,
    });
    expect(summary.errors.map((group) => [group.count, group.event])).toEqual([
      [2, "db"],
      [1, null],
    ]);
    expect(summary.errors[0]?.first).toBe("2026-11-23T10:00:00Z");
    expect(summary.errors[0]?.last).toBe("2026-11-23T10:00:05Z");
  });
});
