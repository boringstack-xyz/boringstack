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
  securityShardLane,
  type ISandboxLane,
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
  const shards = security ? runner.budget.securityShards : 0;
  const shardLanes = Array.from({ length: shards }, (_, offset) =>
    securityShardLane(offset + 1, shards)
  );
  const lanes: ISandboxLane[] = [
    ...shardLanes,
    ...(feature ? [SANDBOX_LANES.tests, SANDBOX_LANES.e2e] : []),
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

  if (feature) {
    tasks.push(
      runner.task(
        "api.tests",
        () => runner.apiTests(release),
        ["api.migrate.tests", "api.templates"],
        1,
        70,
        profile === "release-local"
          ? ["api.tests", "api.coverage"]
          : ["api.tests"]
      )
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
    const files = runner.securityShardFiles(shards);
    const count = files.length;
    const shardIds = files.map(
      (_, offset) => `security.tests.${String(offset + 1)}`
    );

    files.forEach((shardFiles, offset) => {
      const index = offset + 1;
      const lane = securityShardLane(index, count);

      tasks.push(
        runner.task(
          count === 1 ? "security.tests" : (shardIds[offset] ?? ""),
          () => runner.securityShard(index, count, shardFiles),
          [`api.migrate.${lane.name}`, "api.templates"],
          1,
          90,
          count === 1 ? ["security.tests", "security.manifest"] : undefined
        )
      );
    });

    if (count > 1) {
      tasks.push(
        runner.task(
          "security.tests",
          () => {
            runner.securityAggregate(count);

            return Promise.resolve();
          },
          shardIds,
          1,
          90,
          ["security.tests", "security.manifest"]
        )
      );
    }
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
