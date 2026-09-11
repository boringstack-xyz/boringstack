import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { now } from "../../apps/api/src/lib/time/now";
import { identifyCheckout } from "../agent/checkout";
import { planAccountResource } from "../agent/generate/account-resource";
import { copyFixture } from "../agent/generate/fixture";
import { formatEdits } from "../agent/generate/format";
import type { IEdit } from "../agent/generate/patch";
import { apply } from "../agent/generate/patch";
import { runProcess } from "../agent/process";
import type { ICheckResult } from "../agent/result";
import {
  downSandbox,
  sandboxEnv,
  upSandbox,
  type ISandbox,
} from "../agent/sandbox/lifecycle";
import { evaluateApi } from "./api-evaluation";
import type { IEvaluationContext } from "./evaluation.types";
import { evaluateMigration } from "./migration-evaluation";
import { candidateEdits, migrationEdits } from "./submission";
import { evaluateUi } from "./ui-evaluation";

const NO_ENV_FILE = "--no-env-file";

const API_DIRECTORY = "apps/api";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "bs-eval-"));
let sandbox: ISandbox | undefined;
const results: ICheckResult[] = [];
const evidenceDir = mkdtempSync(join(tmpdir(), "bs-evidence-"));
const startedAt = now();
const checkout = identifyCheckout(root);

try {
  const args = process.argv.slice(2);
  const candidate =
    args.length === 1 && args[0]?.startsWith("--candidate=") === true
      ? args[0].slice(12)
      : undefined;

  if (candidate === undefined && args.join(" ") !== "--deterministic") {
    throw new Error("Use --deterministic or --candidate=/absolute/checkout");
  }

  copyFixture(root, dir);
  const apiEdits = await formatEdits(
    dir,
    planAccountResource(dir, "Projects", "team-read-admin-write")
  );
  const submitted =
    candidate !== undefined
      ? new Map(
          candidateEdits(candidate, apiEdits).map((plannedEdit) => [
            plannedEdit.path,
            plannedEdit,
          ])
        )
      : new Map<string, IEdit>();

  apply(
    dir,
    apiEdits.map(
      (plannedEdit) => submitted.get(plannedEdit.path) ?? plannedEdit
    )
  );

  if (candidate !== undefined) {
    apply(dir, migrationEdits(dir, candidate));
  }

  sandbox = await upSandbox(root);
  const env = sandboxEnv(sandbox);

  for (const script of [
    ...(candidate !== undefined ? [] : ["db:generate"]),
    "db:migrate",
    "build:templates",
  ]) {
    const run = await runProcess(
      [process.execPath, NO_ENV_FILE, "run", script],
      { cwd: join(dir, API_DIRECTORY), env }
    );

    if (run.code !== 0) {
      throw new Error("Fixture prerequisite failed");
    }
  }

  const context: IEvaluationContext = {
    root,
    dir,
    evidenceDir,
    candidate,
    env,
    results,
    sandbox,
  };

  await evaluateApi(context);
  await evaluateUi(context);

  if (candidate === undefined) {
    await evaluateMigration(context);
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Evaluation failed"}\n`
  );
  results.push({
    checkId: "eval.prerequisites",
    status: "blocked",
    reason: "evaluation_prerequisite_failed",
  });
} finally {
  if (sandbox) {
    await downSandbox(root, sandbox.id).catch(() => {
      results.push({
        checkId: "eval.cleanup",
        status: "blocked",
        reason: "cleanup_required",
      });
    });
  }

  rmSync(dir, { recursive: true, force: true });
  rmSync(evidenceDir, { recursive: true, force: true });
}

if (identifyCheckout(root).fingerprint !== checkout.fingerprint) {
  results.push({
    checkId: "checkout.stable",
    status: "blocked",
    reason: "checkout_changed",
  });
}

const status = results.some((check) => check.status === "blocked")
  ? "blocked"
  : results.some((check) => check.status === "failed")
    ? "failed"
    : "passed";

console.log(
  JSON.stringify({
    schemaVersion: 1,
    runId: crypto.randomUUID(),
    startedAt,
    finishedAt: now(),
    checkout,
    kind:
      process.argv[2]?.startsWith("--candidate=") === true
        ? "candidate-review"
        : "deterministic-judge",
    status,
    checks: results,
    liveAgentRuns: 0,
  })
);
process.exitCode = status === "passed" ? 0 : status === "failed" ? 1 : 2;
