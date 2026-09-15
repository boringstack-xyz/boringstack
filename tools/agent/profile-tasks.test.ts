import { expect, test } from "bun:test";
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
const runner = new ProfileRunner(
  "/unused",
  "/unused",
  result,
  undefined,
  "fixture",
  { slots: 14, testWorkers: 4 }
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
    "api.migrate.security",
    "api.migrate.tests",
    "api.migrate.e2e",
  ]);
  expect(migrations(feature)).toEqual(["api.migrate.tests", "api.migrate.e2e"]);
  expect(migrations(security)).toEqual(["api.migrate.security"]);
  expect(release.filter((task) => task.id === "api.tests")).toHaveLength(1);
  expect(release.some((task) => task.id === "api.coverage")).toBe(false);
  expect(release.find((task) => task.id === "ui.e2e")?.slots).toBe(4);
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
