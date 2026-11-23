import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { EventEmitter } from "node:events";

import {
  isValkeyConnectionError,
  isValkeyDown,
  resetValkeyConnectionWatch,
  watchValkeyConnection,
} from "../../../src/clients/valkey/valkey.connection-watch";
import { logger } from "../../../src/config/logger";

const refused = (): Error =>
  Object.assign(new Error("connect ECONNREFUSED 10.43.38.207:6379"), {
    code: "ECONNREFUSED",
  });

const watchEvents = (calls: unknown[]): string[] =>
  JSON.stringify(calls).match(/valkey\.connection\.[a-z]+/gu) ?? [];

const rethrow = (err: Error): never => {
  throw err;
};

const watched = (
  source: string,
  onOther: (err: Error) => void = rethrow
): EventEmitter => {
  const client = new EventEmitter();

  watchValkeyConnection(client, source, onOther);

  return client;
};

const spyLogs = () => ({
  warn: spyOn(logger, "warn"),
  info: spyOn(logger, "info"),
  error: spyOn(logger, "error"),
});

describe("watchValkeyConnection", () => {
  beforeEach(() => {
    resetValkeyConnectionWatch();
  });

  afterEach(() => {
    mock.restore();
    resetValkeyConnectionWatch();
  });

  test("a restart across many clients logs one lost and one restored line", () => {
    const logs = spyLogs();
    const cache = watched("cache");
    const rateLimit = watched("rate-limit");
    const worker = watched("email-delivery worker");

    for (let attempt = 0; attempt < 30; attempt++) {
      cache.emit("error", refused());
      rateLimit.emit("error", refused());
      worker.emit("error", refused());
    }

    expect(isValkeyDown()).toBe(true);

    cache.emit("ready");
    rateLimit.emit("ready");
    expect(watchEvents(logs.info.mock.calls)).toEqual([]);

    worker.emit("ready");

    expect(watchEvents(logs.warn.mock.calls)).toEqual([
      "valkey.connection.lost",
    ]);
    expect(watchEvents(logs.info.mock.calls)).toEqual([
      "valkey.connection.restored",
    ]);
    expect(watchEvents(logs.error.mock.calls)).toEqual([]);
    expect(isValkeyDown()).toBe(false);
  });

  test("a closed client does not hold the outage open", () => {
    const logs = spyLogs();
    const cache = watched("cache");
    const oauth = watched("oauth-state");

    cache.emit("error", refused());
    oauth.emit("error", refused());
    oauth.emit("end");
    cache.emit("ready");

    expect(watchEvents(logs.info.mock.calls)).toEqual([
      "valkey.connection.restored",
    ]);
  });

  test("an outage that outlasts the threshold logs one ERROR", async () => {
    resetValkeyConnectionWatch({ escalateAfterMs: 10 });
    const logs = spyLogs();
    const cache = watched("cache");

    cache.emit("error", refused());
    await Bun.sleep(30);
    cache.emit("error", refused());

    expect(watchEvents(logs.error.mock.calls)).toEqual([
      "valkey.connection.down",
    ]);

    cache.emit("ready");

    expect(watchEvents(logs.info.mock.calls)).toEqual([
      "valkey.connection.restored",
    ]);
  });

  test("non-connection errors go to the caller's handler", () => {
    const logs = spyLogs();
    const seen: string[] = [];
    const worker = watched("email-delivery worker", (err: Error) => {
      seen.push(err.message);
    });

    worker.emit("error", new Error("Missing lock for job 42"));

    expect(seen).toEqual(["Missing lock for job 42"]);
    expect(isValkeyDown()).toBe(false);
    expect(watchEvents(logs.warn.mock.calls)).toEqual([]);
  });

  test("ready without a prior failure is silent", () => {
    const logs = spyLogs();

    watched("cache").emit("ready");

    expect(watchEvents(logs.info.mock.calls)).toEqual([]);
  });
});

describe("isValkeyConnectionError", () => {
  test.each([
    ["connect ETIMEDOUT", "ETIMEDOUT"],
    ["connect ECONNREFUSED 10.43.38.207:6379", "ECONNREFUSED"],
    ["getaddrinfo ENOTFOUND valkey", "ENOTFOUND"],
    ["Connection is closed.", ""],
  ])("%s is a connection error", (message: string, code: string) => {
    const err = Object.assign(new Error(message), { code });

    expect(isValkeyConnectionError(err)).toBe(true);
  });

  test("a command error is not", () => {
    expect(
      isValkeyConnectionError(new Error("WRONGTYPE Operation against a key"))
    ).toBe(false);
  });
});
