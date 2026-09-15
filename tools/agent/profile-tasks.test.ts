import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { ProfileRunner } from "./profile-runner";
import { aggregateChecks, profileTasks } from "./profile-tasks";
import type { IVerificationResult } from "./result";

const result: IVerificationResult = {
  schemaVersion: 1,
  runId: "fixture",
  profile: "release-local",
  startedAt: "",
  finishedAt: "",
  checkout: null,
  source: "owned-sandbox",
  status: "blocked",
  checks: [],
};
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const runner = new ProfileRunner(
  ROOT,
  "/unused",
  result,
  undefined,
  "fixture",
  {
    slots: 14,
    testWorkers: 4,
    uiTestWorkers: 7,
    securityShards: 4,
    apiShards: 4,
  }
);
const serial = new ProfileRunner(
  ROOT,
  "/unused",
  result,
  undefined,
  "fixture",
  {
    slots: 1,
    testWorkers: 1,
    uiTestWorkers: 1,
    securityShards: 1,
    apiShards: 1,
  }
);

test("profiles prepare only used lanes and release tests supply coverage once", () => {
  const release = profileTasks(runner, "release-local", "fixture");
  const feature = profileTasks(runner, "feature", "fixture");
  const security = profileTasks(runner, "security", "fixture");
  const migrations = (tasks: typeof release): string[] =>
    tasks
      .filter((task) => task.id.startsWith("api.migrate."))
      .map((task) => task.id);

  expect(migrations(release)).toEqual([
    "api.migrate.security-1",
    "api.migrate.security-2",
    "api.migrate.security-3",
    "api.migrate.security-4",
    "api.migrate.tests-1",
    "api.migrate.tests-2",
    "api.migrate.tests-3",
    "api.migrate.tests-4",
    "api.migrate.e2e",
  ]);
  expect(migrations(feature)).toEqual([
    "api.migrate.tests-1",
    "api.migrate.tests-2",
    "api.migrate.tests-3",
    "api.migrate.tests-4",
    "api.migrate.e2e",
  ]);
  expect(migrations(security)).toEqual([
    "api.migrate.security-1",
    "api.migrate.security-2",
    "api.migrate.security-3",
    "api.migrate.security-4",
  ]);
  expect(release.filter((task) => task.id === "api.tests")).toHaveLength(1);
  expect(
    release.filter((task) => /^api\.tests\.\d$/.test(task.id))
  ).toHaveLength(4);
  expect(release.find((task) => task.id === "api.tests")?.after).toEqual([
    "api.tests.1",
    "api.tests.2",
    "api.tests.3",
    "api.tests.4",
  ]);
  expect(release.some((task) => task.id === "api.coverage")).toBe(false);
  expect(
    profileTasks(serial, "release-local", "fixture").filter((task) =>
      task.id.startsWith("api.tests")
    )
  ).toHaveLength(1);
  expect(release.find((task) => task.id === "ui.e2e")?.slots).toBe(4);
  expect(release.find((task) => task.id === "ui.tests")?.slots).toBe(7);
  expect(release.find((task) => task.id === "ui.tests")?.after).toEqual([]);
  expect(release.find((task) => task.id === "ui.build")?.after).toEqual([]);
  expect(release.find((task) => task.id === "api.build")?.after).toContain(
    "api.templates"
  );
  expect(release.find((task) => task.id === "ui.bundle")?.after).toEqual([
    "ui.build",
  ]);
});

test("missing aggregate constituents block evidence instead of implying a complete check", () => {
  expect(aggregateChecks([]).every((check) => check.status === "blocked")).toBe(
    true
  );
});

test("the security spec shards across lanes and aggregates, or runs whole with one worker", () => {
  const sharded = profileTasks(runner, "security", "fixture");
  const shardTasks = sharded.filter((task) =>
    /^security\.tests\.\d$/.test(task.id)
  );
  const aggregate = sharded.find((task) => task.id === "security.tests");

  expect(shardTasks.map((task) => task.id)).toEqual([
    "security.tests.1",
    "security.tests.2",
    "security.tests.3",
    "security.tests.4",
  ]);
  expect(shardTasks[2]?.after).toEqual([
    "api.migrate.security-3",
    "api.templates",
  ]);
  expect(aggregate?.after).toEqual(shardTasks.map((task) => task.id));

  const whole = profileTasks(serial, "security", "fixture");

  expect(
    whole.filter((task) => task.id.startsWith("security.tests"))
  ).toHaveLength(1);
  expect(whole.find((task) => task.id === "security.tests")?.after).toEqual([
    "api.migrate.security",
    "api.templates",
  ]);
  expect(whole.map((task) => task.id)).toContain("api.migrate.security");
});

test("shard files cover every spec file exactly once", () => {
  const shards = runner.shardedFiles("security", 4);
  const whole = runner.shardedFiles("security", 1);
  const flat = shards.flat().sort();

  expect(shards).toHaveLength(4);
  expect(flat).toEqual([...(whole[0] ?? [])].sort());
  expect(new Set(flat).size).toBe(flat.length);
  expect(flat.length).toBeGreaterThan(10);
});

test("API test files are found recursively and cover every file once", () => {
  const shards = runner.shardedFiles("tests", 4);
  const flat = shards.flat();

  expect(shards).toHaveLength(4);
  expect(new Set(flat).size).toBe(flat.length);
  expect(flat.length).toBeGreaterThan(100);
  expect(
    flat.every((path) => path.startsWith("tests/") && path.endsWith(".test.ts"))
  ).toBe(true);
  expect(flat.some((path) => path.split("/").length > 2)).toBe(true);
});
