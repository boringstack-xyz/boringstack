import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatUiEdits } from "../agent/generate/format";
import type { IEdit } from "../agent/generate/patch";
import { apply, replaceOnce } from "../agent/generate/patch";
import { planReferenceUi } from "../agent/generate/reference-ui";
import { runProcess } from "../agent/process";
import { testEvidence } from "../agent/reports";
import { startRuntime } from "../agent/runtime";
import { judge, UI_CASES } from "./judge";
import { candidateEdits } from "./submission";

import type { IEvaluationContext } from "./evaluation.types";

const NO_ENV_FILE = "--no-env-file";

async function evaluateBrowser(
  context: IEvaluationContext,
  runtimeEnv: Record<string, string>
): Promise<void> {
  const { dir, evidenceDir, results } = context;
  const browserReport = join(evidenceDir, "browser.xml");
  const browser = await runProcess(
    [
      "node",
      "node_modules/@playwright/test/cli.js",
      "test",
      "projects.spec.ts",
      "--project=chromium",
      "--retries=0",
      "--reporter=junit",
    ],
    {
      cwd: join(dir, "apps/ui"),
      env: { ...runtimeEnv, PLAYWRIGHT_JUNIT_OUTPUT_FILE: browserReport },
      timeoutMs: 180000,
    }
  );

  if (browser.code !== 0) {
    console.error(
      `Browser runner failed (exit=${String(browser.code)}): ${browser.stderr.slice(-4000)}\n${browser.stdout.slice(-8000)}`
    );
  }

  results.push(
    testEvidence(
      "projects.browser",
      await Bun.file(browserReport)
        .text()
        .catch(() => ""),
      browser.code,
      "playwright"
    )
  );
}

async function evaluateCache(
  context: IEvaluationContext,
  runtimeEnv: Record<string, string>
): Promise<void> {
  const { dir, candidate, evidenceDir, results } = context;
  const keys = join(dir, "apps/ui/src/features/projects/Projects.constants.ts");
  const correctKeys = readFileSync(keys, "utf8");

  for (const mutant of candidate !== undefined ? [false] : [false, true]) {
    writeFileSync(
      keys,
      mutant
        ? replaceOnce(
            correctKeys,
            '"projects", accountId, "list"',
            '"projects", "list"'
          )
        : correctKeys
    );
    const report = join(
      evidenceDir,
      mutant ? "cache-mutant.xml" : "cache-good.xml"
    );
    const run = await runProcess(
      [
        process.execPath,
        NO_ENV_FILE,
        "node_modules/vitest/vitest.mjs",
        "run",
        "src/features/projects",
        "--reporter=junit",
        `--outputFile=${report}`,
      ],
      { cwd: join(dir, "apps/ui"), env: runtimeEnv }
    );

    results.push(
      judge(
        mutant ? "stale-cache" : "ui-known-good",
        await Bun.file(report)
          .text()
          .catch(() => ""),
        run.code,
        UI_CASES,
        mutant ? [UI_CASES[4], UI_CASES[5]] : []
      )
    );
  }

  writeFileSync(keys, correctKeys);
}

export async function evaluateUi(context: IEvaluationContext): Promise<void> {
  const { root, dir, candidate, results, sandbox } = context;
  const uiEdits = await formatUiEdits(dir, planReferenceUi(dir));
  const submittedUi =
    candidate !== undefined
      ? new Map(
          candidateEdits(candidate, uiEdits).map((plannedEdit) => [
            plannedEdit.path,
            plannedEdit,
          ])
        )
      : new Map<string, IEdit>();

  apply(
    dir,
    uiEdits.map(
      (plannedEdit) => submittedUi.get(plannedEdit.path) ?? plannedEdit
    )
  );
  const runtime = await startRuntime(dir, sandbox);

  try {
    for (const { app, script } of [
      { app: "api", script: "generate:acl-types" },
      { app: "ui", script: "generate:api" },
    ]) {
      const run = await runProcess(
        [process.execPath, NO_ENV_FILE, "run", script],
        { cwd: join(dir, "apps", app), env: runtime.env }
      );

      if (run.code !== 0) {
        throw new Error("Contract generation failed");
      }
    }

    writeFileSync(
      join(dir, "apps/ui/src/features/projects/Projects.queries.test.tsx"),
      readFileSync(
        join(
          root,
          "tools/agent-evals/acceptance/account-cache.test.tsx.template"
        ),
        "utf8"
      )
    );
    await evaluateCache(context, runtime.env);

    writeFileSync(
      join(dir, "apps/ui/e2e/projects.spec.ts"),
      readFileSync(
        join(root, "tools/agent-evals/acceptance/projects.spec.ts.template"),
        "utf8"
      )
    );

    for (const app of ["api", "ui"]) {
      const run = await runProcess(
        [process.execPath, NO_ENV_FILE, "run", "check"],
        { cwd: join(dir, "apps", app), env: runtime.env, timeoutMs: 600000 }
      );

      results.push({
        checkId: `${app}.check`,
        status:
          run.status === "blocked"
            ? "blocked"
            : run.code === 0
              ? "passed"
              : "failed",
        reason:
          run.status === "blocked"
            ? run.reason
            : run.code === 0
              ? "command_passed"
              : "command_failed",
      });
    }

    await evaluateBrowser(context, runtime.env);
  } finally {
    await runtime.stop();
  }
}
