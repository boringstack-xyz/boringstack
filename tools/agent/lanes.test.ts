import { expect, test } from "bun:test";
import { defaultConcurrency, orderChecks, runLanes } from "./lanes";
import type { ICheckResult } from "./result";
import { SANDBOX_LANES, sandboxEnv, type ISandbox } from "./sandbox/lifecycle";

const sandbox: ISandbox = {
  version: 1,
  id: "0123456789abcdef0123456789abcdef",
  owner: "owner",
  root: "/repo",
  createdAt: "2026-09-14T00:00:00.000Z",
  password: "pg-secret",
  valkeyPassword: "valkey-secret",
  postgres: "pg",
  valkey: "valkey",
  postgresPort: 45000,
  valkeyPort: 45001,
};

test("lanes run together within the budget and every lane completes", async () => {
  let inFlight = 0;
  let peak = 0;
  const finished: number[] = [];
  const lanes = Array.from({ length: 6 }, (_, index) => async () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await Bun.sleep(10);
    inFlight -= 1;
    finished.push(index);
  });

  await runLanes(lanes, 3);

  expect(finished.sort((left, right) => left - right)).toEqual([
    0, 1, 2, 3, 4, 5,
  ]);
  expect(peak).toBe(3);
});

test("a failing lane does not cancel the others and is rethrown afterwards", async () => {
  const seen: string[] = [];
  const lanes = [
    async () => {
      await Bun.sleep(5);
      seen.push("first");
    },
    () => Promise.reject(new Error("lane exploded")),
    async () => {
      await Bun.sleep(15);
      seen.push("third");
    },
  ];

  let caught: unknown = undefined;

  try {
    await runLanes(lanes, 2);
  } catch (error) {
    caught = error;
  }

  expect(caught instanceof Error ? caught.message : "").toBe("lane exploded");
  expect(seen.sort()).toEqual(["first", "third"]);
});

test("an abort stops lanes that have not started", async () => {
  const controller = new AbortController();
  const started: number[] = [];
  const lanes = Array.from({ length: 4 }, (_, index) => async () => {
    started.push(index);
    controller.abort();
    await Bun.sleep(1);
  });

  await runLanes(lanes, 1, controller.signal);

  expect(started).toEqual([0]);
});

test("concurrency honours AGENT_VERIFY_PARALLEL and otherwise stays in band", () => {
  expect(defaultConcurrency({ AGENT_VERIFY_PARALLEL: "1" })).toBe(1);
  expect(defaultConcurrency({ AGENT_VERIFY_PARALLEL: "9" })).toBe(9);
  expect(
    defaultConcurrency({ AGENT_VERIFY_PARALLEL: "zero" })
  ).toBeGreaterThanOrEqual(1);
  expect(defaultConcurrency({})).toBeLessThanOrEqual(24);
});

test("checks report in the declared order regardless of completion order", () => {
  const checks: ICheckResult[] = [
    { checkId: "ui.e2e", status: "passed", reason: "x" },
    { checkId: "mystery", status: "passed", reason: "x" },
    { checkId: "api.tests", status: "passed", reason: "x" },
    { checkId: "sandbox.ready", status: "passed", reason: "x" },
  ];

  expect(
    orderChecks(checks, ["sandbox.ready", "api.tests", "ui.e2e"]).map(
      (check) => check.checkId
    )
  ).toEqual(["sandbox.ready", "api.tests", "ui.e2e", "mystery"]);
});

test("each stateful lane gets its own database and Valkey index in the same sandbox", () => {
  const base = sandboxEnv(sandbox);
  const tests = sandboxEnv(sandbox, SANDBOX_LANES.tests);
  const e2e = sandboxEnv(sandbox, SANDBOX_LANES.e2e);

  expect(base.DATABASE_URL).toBe(
    "postgresql://app:pg-secret@127.0.0.1:45000/app"
  );
  expect(base.VALKEY_DB).toBe("0");
  expect(tests.DATABASE_URL).toBe(
    "postgresql://app:pg-secret@127.0.0.1:45000/app_tests"
  );
  expect(tests.TEST_DATABASE_URL).toBe(tests.DATABASE_URL);
  expect(tests.VALKEY_DB).toBe("1");
  expect(e2e.DATABASE_URL).toBe(
    "postgresql://app:pg-secret@127.0.0.1:45000/app_e2e"
  );
  expect(e2e.VALKEY_DB).toBe("3");
  expect(
    new Set(
      Object.values(SANDBOX_LANES).map(
        (lane) => `${lane.database}/${String(lane.valkeyDb)}`
      )
    ).size
  ).toBe(Object.keys(SANDBOX_LANES).length);
});
