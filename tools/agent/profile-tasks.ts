import {
  CHECK_GROUPS,
  RELEASE_CHECKS,
  STATIC_CHECKS,
  type Profile,
} from "./checks";
import type { ProfileRunner } from "./profile-runner";
import type { ICheckResult } from "./result";
import type { ITask } from "./scheduler";
import {
  SANDBOX_LANES,
  shardLane,
  type ISandboxLane,
  type ShardedSuite,
} from "./sandbox/lifecycle";
import { requireValue } from "./validation";

export function profileTasks(
  runner: ProfileRunner,
  profile: Profile,
  fingerprint: string
): ITask[] {
  const tasks = profile === "security" ? [] : runner.scriptTasks(STATIC_CHECKS);
  const release = profile === "release-local";
  const feature = profile === "feature" || release;
  const security = profile === "security" || release;
  const shardCount: Record<ShardedSuite, number> = {
    security: security ? runner.budget.securityShards : 0,
    tests: feature ? runner.budget.apiShards : 0,
  };
  const laneList = (suite: ShardedSuite): ISandboxLane[] =>
    Array.from({ length: shardCount[suite] }, (_, offset) =>
      shardLane(suite, offset + 1, shardCount[suite])
    );
  const lanes: ISandboxLane[] = [
    ...laneList("security"),
    ...laneList("tests"),
    ...(feature ? [SANDBOX_LANES.e2e] : []),
  ];

  if (lanes.length > 0) {
    tasks.push(
      runner.task(
        "sandbox.ready",
        () => runner.prepareSandbox(lanes),
        [],
        1,
        100
      )
    );
    tasks.push(
      runner.task("api.templates", () => runner.templates(), [], 1, 100)
    );

    for (const lane of lanes) {
      tasks.push(
        runner.task(
          `api.migrate.${lane.name}`,
          () => runner.migrate(lane),
          ["sandbox.ready"],
          1,
          100
        )
      );
    }
  }

  /*
   * A sharded suite is one task per shard plus an aggregate that merges the
   * reports. With one shard the single task carries the suite's evidence.
   */
  const shardedSuite = (
    suite: ShardedSuite,
    aggregateId: string,
    evidence: readonly string[],
    priority: number,
    coverage: boolean
  ): void => {
    const files = runner.shardedFiles(suite, shardCount[suite]);
    const count = files.length;
    const shardIds = files.map(
      (_, offset) => `${aggregateId}.${String(offset + 1)}`
    );

    files.forEach((shardFiles, offset) => {
      const index = offset + 1;
      const lane = shardLane(suite, index, count);

      tasks.push(
        runner.task(
          count === 1 ? aggregateId : (shardIds[offset] ?? ""),
          () => runner.shard(suite, index, count, shardFiles, coverage),
          [`api.migrate.${lane.name}`, "api.templates"],
          1,
          priority,
          count === 1 ? evidence : undefined
        )
      );
    });

    if (count > 1) {
      tasks.push(
        runner.task(
          aggregateId,
          () => runner.aggregate(suite, count, coverage),
          shardIds,
          1,
          priority,
          evidence
        )
      );
    }
  };

  if (feature) {
    shardedSuite(
      "tests",
      "api.tests",
      release ? ["api.tests", "api.coverage"] : ["api.tests"],
      70,
      release
    );
    tasks.push(
      runner.task(
        "ui.tests",
        () => runner.uiTests(fingerprint),
        [],
        runner.budget.uiTestWorkers,
        70
      )
    );
    tasks.push(
      runner.task(
        "ui.e2e",
        () =>
          runner.e2e(requireValue(runner.state, "Sandbox absent"), fingerprint),
        ["api.migrate.e2e", "api.templates"],
        runner.budget.testWorkers,
        80,
        ["runtime.ready", "openapi.drift", "ui.e2e"]
      )
    );
  }

  if (security) {
    shardedSuite(
      "security",
      "security.tests",
      ["security.tests", "security.manifest"],
      90,
      false
    );
  }

  if (release) {
    tasks.push(...runner.scriptTasks(RELEASE_CHECKS));
  }

  return tasks;
}

/** Keep aggregate check IDs for consumers while exposing each constituent's result. */
export function aggregateChecks(
  checks: readonly ICheckResult[]
): ICheckResult[] {
  return CHECK_GROUPS.map((group) => {
    const parts = group.parts.map((script) =>
      checks.find((check) => check.checkId === `${group.id}.${script}`)
    );
    const status = parts.some(
      (check) => check === undefined || check.status === "blocked"
    )
      ? "blocked"
      : parts.some((check) => check?.status === "failed")
        ? "failed"
        : "passed";

    return {
      checkId: group.id,
      status,
      reason: `constituent_checks_${status}`,
    };
  });
}
