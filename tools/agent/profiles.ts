import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { now } from "../../apps/api/src/lib/time/now";
import { identifyCheckout } from "./checkout";
import { RELEASE_CHECKS, STATIC_CHECKS, type Profile } from "./checks";
import { openApiUrl } from "./environment";
import { orderChecks } from "./lanes";
import { executionBudget } from "./scheduling";
import { runTasks } from "./scheduler";
import { aggregateChecks, profileTasks } from "./profile-tasks";
import { ProfileRunner } from "./profile-runner";
import type { IVerificationResult } from "./result";
import { isAborted } from "./validation";
import { verify } from "./verification";
import { acquireWorkspace } from "./workspace-lock";

/** Reporting order; lanes complete in machine order. */
const CHECK_ORDER: readonly string[] = [
  "sandbox.ready",
  "api.migrate",
  "api.migrate.tests",
  "api.migrate.security",
  "api.migrate.e2e",
  "api.migrate.coverage",
  "api.templates",
  "tooling.quality",
  "api.check",
  "ui.check",
  ...STATIC_CHECKS.map((check) => check.id),
  "security.tests",
  "security.manifest",
  "api.tests",
  "ui.tests",
  "openapi.drift",
  "runtime.ready",
  "ui.e2e",
  "api.coverage",
  ...RELEASE_CHECKS.map((check) => check.id),
  "checkout.stable",
  "run.completed",
  "run.prerequisites",
];

export async function runProfile(
  root: string,
  profile: Profile,
  sandboxId?: string,
  signal?: AbortSignal
): Promise<IVerificationResult> {
  if (profile === "openapi") {
    return verify(root, openApiUrl(), signal);
  }

  const result: IVerificationResult = {
    schemaVersion: 1,
    runId: crypto.randomUUID(),
    profile,
    startedAt: now(),
    finishedAt: "",
    checkout: null,
    source: profile === "static" ? "checkout" : "owned-sandbox",
    status: "blocked",
    checks: [],
  };
  const temp = mkdtempSync(join(tmpdir(), "bs-verification-"));
  let releaseWorkspace: (() => void) | undefined;

  const budget = executionBudget();
  const runner = new ProfileRunner(
    root,
    temp,
    result,
    signal,
    sandboxId,
    budget
  );

  try {
    releaseWorkspace = acquireWorkspace(root);
    result.checkout = identifyCheckout(root);

    const tasks = profileTasks(runner, profile, result.checkout.fingerprint);

    process.stderr.write(
      `Verification budget: ${String(budget.slots)} CPU slots; ${String(budget.testWorkers)} workers per test pool\n`
    );
    result.execution = {
      ...budget,
      tasks: await runTasks(tasks, budget.slots, signal, (id, state) => {
        if (state === "started") {
          process.stderr.write(`${id}: running\n`);
        }
      }),
    };

    if (profile !== "security") {
      for (const check of aggregateChecks(result.checks)) {
        runner.add(check);
      }
    }

    if (isAborted(signal)) {
      throw new Error("interrupted");
    }

    if (identifyCheckout(root).fingerprint !== result.checkout.fingerprint) {
      runner.add({
        checkId: "checkout.stable",
        status: "blocked",
        reason: "checkout_changed",
      });
    } else {
      runner.add({
        checkId: "checkout.stable",
        status: "passed",
        reason: "checkout_unchanged",
      });
    }

    if (isAborted(signal)) {
      runner.add({
        checkId: "run.completed",
        status: "blocked",
        reason: "interrupted",
      });
    }

    result.status = result.checks.some((check) => check.status === "blocked")
      ? "blocked"
      : result.checks.some((check) => check.status === "failed")
        ? "failed"
        : "passed";
  } catch (error) {
    runner.add({
      checkId: "run.prerequisites",
      status: "blocked",
      reason:
        error instanceof Error &&
        (error.message === "interrupted" ||
          error.message === "checkout_requires_git" ||
          error.message.startsWith("checkout_locked") ||
          error.message.startsWith("lease_locked") ||
          error.message.startsWith("sandbox_not_found"))
          ? (error.message.split(":")[0] ?? "required_prerequisite_unavailable")
          : "required_prerequisite_unavailable",
    });
    result.status = "blocked";
  } finally {
    result.checks = orderChecks(result.checks, CHECK_ORDER);
    runner.releaseLease?.();
    releaseWorkspace?.();
    result.finishedAt = now();
    rmSync(temp, { recursive: true, force: true });
  }

  return result;
}
