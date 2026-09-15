import {
  CHECK_GROUPS,
  RELEASE_CHECKS,
  STATIC_CHECKS,
  type Profile,
} from "./checks";
import type { ProfileRunner } from "./profile-runner";
import type { ICheckResult } from "./result";
import type { ITask } from "./scheduler";
import type { SandboxLaneName } from "./sandbox/lifecycle";
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
  const lanes: SandboxLaneName[] = [
    ...(security ? (["security"] as const) : []),
    ...(feature ? (["tests", "e2e"] as const) : []),
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
          `api.migrate.${lane}`,
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
        () => runner.tests(false, release),
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
        runner.budget.testWorkers,
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
    tasks.push(
      runner.task(
        "security.tests",
        () => runner.tests(true),
        ["api.migrate.security", "api.templates"],
        1,
        90,
        ["security.tests", "security.manifest"]
      )
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
