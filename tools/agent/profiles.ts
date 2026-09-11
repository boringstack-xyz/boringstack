import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { now } from "../../apps/api/src/lib/time/now";
import { identifyCheckout } from "./checkout";
import { RELEASE_CHECKS, STATIC_CHECKS, type Profile } from "./checks";
import { openApiUrl } from "./environment";
import { ProfileRunner } from "./profile-runner";
import type { IVerificationResult } from "./result";
import { isAborted } from "./validation";
import { verify } from "./verification";
import { acquireWorkspace } from "./workspace-lock";

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

  const runner = new ProfileRunner(root, temp, result, signal, sandboxId);

  try {
    releaseWorkspace = acquireWorkspace(root);
    result.checkout = identifyCheckout(root);

    if (profile !== "static") {
      await runner.prepareSandbox();
    }

    if (profile !== "security") {
      await runner.scripts(STATIC_CHECKS);
    }

    if (isAborted(signal)) {
      throw new Error("interrupted");
    }

    if (profile === "security" || profile === "release-local") {
      await runner.tests(true);
    }

    if (profile === "feature" || profile === "release-local") {
      if (runner.state === undefined) {
        throw new Error("Sandbox absent");
      }

      await runner.feature(runner.state, result.checkout.fingerprint);
    }

    if (profile === "release-local") {
      await runner.scripts(RELEASE_CHECKS);
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
          error.message.startsWith("checkout_locked"))
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
