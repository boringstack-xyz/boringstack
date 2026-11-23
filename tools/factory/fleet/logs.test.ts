import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { logsCommand, parseLogsArgs } from "./logs";
import { contextAt, fakeRunner, tempDir } from "./fleet.test-helpers";

const psLine = (name: string, service: string): string =>
  JSON.stringify({
    Names: name,
    State: "running",
    Status: "Up (healthy)",
    Ports: "",
    Labels: `com.docker.compose.project=boringstack-s1,com.docker.compose.service=${service}`,
  });

const apiLog = [
  '2026-11-23T10:00:01.000Z {"level":"ERROR","event":"db_timeout","requestId":"req-1","msg":"query timed out after 900 ms"}',
  '2026-11-23T10:00:02.000Z {"level":"INFO","msg":"GET /api/v1/accounts 200","requestId":"req-1"}',
  '2026-11-23T10:00:03.000Z {"level":"ERROR","event":"db_timeout","msg":"query timed out after 1200 ms"}',
  '2026-11-23T10:00:04.000Z {"level":"DEBUG","msg":"GET /health 200"}',
].join("\n");

const runner = () =>
  fakeRunner((program, args) => {
    if (args[0] === "ps") {
      return {
        status: 0,
        stdout: psLine("boringstack-s1-api-1", "api"),
        stderr: "",
      };
    }

    if (args[0] === "logs") {
      return { status: 0, stdout: apiLog, stderr: "" };
    }

    return { status: 1, stdout: "", stderr: `unexpected ${program}` };
  });

const now = Date.parse("2026-11-23T10:30:00Z");

describe("factory logs", () => {
  test("flags that do not read fail with the flag named", () => {
    expect(parseLogsArgs(["--since", "15m", "--errors"])).toMatchObject({
      errors: true,
      since: "15m",
      slot: null,
    });
    expect(parseLogsArgs(["--bogus"])).toContain("--bogus");
    expect(parseLogsArgs(["--slot", "0"])).toBe(
      "--slot takes a stack number, 1 or more"
    );
  });

  test("a workspace with no claim is told to pass --slot", () => {
    const outcome = logsCommand(
      [],
      contextAt(tempDir("logs-none"), tempDir("shared-none")),
      runner().run,
      () => now
    );

    expect(outcome.code).toBe(2);
    expect(outcome.summary).toContain("--slot");
  });

  test("the claimed workspace's stack is read, errors first, probes left out", () => {
    const root = tempDir("logs-root");
    const shared = tempDir("logs-shared");

    mkdirSync(join(shared, "slots"), { recursive: true });
    writeFileSync(
      join(shared, "slots", "s1.json"),
      JSON.stringify({ workspace: root })
    );

    const outcome = logsCommand(
      ["--errors"],
      contextAt(root, shared),
      runner().run,
      () => now
    );

    expect(outcome.code).toBe(0);
    expect(outcome.summary).toContain("query timed out after 900 ms");
    expect(outcome.summary).toContain("[req-1]");
    expect(outcome.summary).not.toContain("GET /health");
    expect(outcome.summary).not.toContain("GET /api/v1/accounts");
  });

  test("--summary groups errors by event and shape", () => {
    const outcome = logsCommand(
      ["--summary", "--slot", "1"],
      contextAt(tempDir("logs-sum"), tempDir("shared-sum")),
      runner().run,
      () => now
    );

    expect(outcome.code).toBe(0);
    expect(outcome.summary).toContain(
      "2x api (db_timeout): query timed out after 900 ms"
    );
    expect(outcome.data).toMatchObject({ slot: 1 });
  });

  test("a stack with no containers is blocked, naming the slot", () => {
    const outcome = logsCommand(
      ["--slot", "3"],
      contextAt(tempDir("logs-empty"), tempDir("shared-empty2")),
      fakeRunner(() => ({ status: 0, stdout: "", stderr: "" })).run,
      () => now
    );

    expect(outcome.code).toBe(2);
    expect(outcome.summary).toContain("Stack 3");
  });
});
