import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { now } from "../../apps/api/src/lib/time/now";
import { identifyCheckout } from "./checkout";
import { RELEASE_CHECKS, STATIC_CHECKS, type Profile } from "./checks";
import { openApiUrl } from "./environment";
import { defaultConcurrency, orderChecks } from "./lanes";
import { ProfileRunner } from "./profile-runner";
import type { IVerificationResult } from "./result";
import { isAborted, requireValue } from "./validation";
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
  ...STATIC_CHECKS.map((check) => check.id),
  "security.tests",
  "security.manifest",
  "api.tests",
  "ui.tests",
  "openapi.drift",
  "runtime.ready",
  "ui.e2e",
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

  const runner = new ProfileRunner(
    root,
    temp,
    result,
    signal,
    sandboxId,
    defaultConcurrency()
  );

  try {
    releaseWorkspace = acquireWorkspace(root);
    result.checkout = identifyCheckout(root);

    if (profile !== "static") {
      await runner.prepareSandbox();
    }

    /*
     * Every lane below is independent: stateless checks share nothing, and
     * each stateful lane (API tests, security spec, browser run, coverage)
     * owns a database and a Valkey index inside the sandbox. They run
     * together within the concurrency budget instead of one after another.
     */
    const lanes = [
      ...(profile === "security" ? [] : runner.scriptLanes(STATIC_CHECKS)),
      ...(profile === "security" || profile === "release-local"
        ? [() => runner.tests(true)]
        : []),
      ...(profile === "feature" || profile === "release-local"
        ? runner.featureLanes(
            requireValue(runner.state, "Sandbox absent"),
            result.checkout.fingerprint
          )
        : []),
      ...(profile === "release-local"
        ? runner.scriptLanes(RELEASE_CHECKS)
        : []),
    ];

    await runner.lanes(lanes);

    if (isAborted(signal)) {
      throw new Error("interrupted");
    }

    result.checks = orderChecks(result.checks, CHECK_ORDER);

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
    runner.releaseLease?.();
    releaseWorkspace?.();
    result.finishedAt = now();
    rmSync(temp, { recursive: true, force: true });
  }

  return result;
}
