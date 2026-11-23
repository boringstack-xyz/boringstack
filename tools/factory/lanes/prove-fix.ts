/*
 * Proves a fix: its regression test fails on the base commit and passes with
 * the fix. Run with the agent's change uncommitted on top of HEAD. Test files
 * stay in place; every other changed file is set back to HEAD, the tests run
 * and must fail; the fix is restored, the tests run again and must pass. The
 * working tree always ends as it started. An unproven fix is a result, not an
 * error: the command exits 0 and says proven: false in its report.
 *
 * Adapted from an earlier agent proof script. The test
 * commands are the ones this repository uses; apps whose tests need Postgres
 * or Valkey cannot be proven on a runner without them, and their skipped tests
 * never count as passing (see skippedIn).
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

import type { ProcessRunner } from "../fleet/process";
import { TEST_FILE } from "./lanes";

export interface IProofApp {
  /** Commands run first, in order, from the app's folder. */
  readonly setup: readonly (readonly string[])[];
  /** The test command for the given files, relative to the app's folder. */
  readonly run: (files: readonly string[]) => readonly string[];
}

/** The apps whose tests a proof can run. Environment is set with `env`, so no process env is read here. */
export const PROOF_APPS: Readonly<Record<string, IProofApp>> = {
  "apps/api": {
    setup: [
      ["bun", "install", "--frozen-lockfile"],
      ["bun", "run", "build:templates"],
    ],
    run: (files) => [
      "env",
      "NODE_ENV=test",
      "LOG_LEVEL=error",
      "bun",
      "test",
      "--timeout",
      "30000",
      ...files,
    ],
  },
  "apps/ui": {
    setup: [["bun", "install", "--frozen-lockfile"]],
    run: (files) => ["bunx", "vitest", "run", ...files],
  },
  "apps/site": {
    setup: [["bun", "install", "--frozen-lockfile"]],
    run: (files) => ["bun", "test", "--timeout", "30000", ...files],
  },
};

export interface IPlanStep {
  readonly app: string;
  readonly setup: readonly (readonly string[])[];
  readonly run: readonly string[];
}

export const splitChange = (
  paths: readonly string[]
): { tests: string[]; fixes: string[] } => ({
  tests: paths.filter((path) => TEST_FILE.test(path)),
  fixes: paths.filter((path) => !TEST_FILE.test(path)),
});

/** One step per app the test files live in, with paths relative to that app. */
export const testPlan = (tests: readonly string[]): IPlanStep[] =>
  Object.entries(PROOF_APPS).flatMap(([app, spec]) => {
    const files = tests
      .filter((path) => path.startsWith(`${app}/`))
      .map((path) => relative(app, path));

    return files.length === 0
      ? []
      : [{ app, setup: spec.setup, run: spec.run(files) }];
  });

/** Skipped tests in a test run's output, in bun's and vitest's summaries. */
export const skippedIn = (log: string): number =>
  [...log.matchAll(/(\d+)\s+skip(?:ped)?\b/gu)].reduce(
    (total, match) => total + Number(match[1]),
    0
  );

export interface IRunOutcome {
  readonly code: number;
  readonly log: string;
}

export interface IProofVerdict {
  readonly proven: boolean;
  readonly reason: string;
}

export const proofVerdict = (input: {
  tests: readonly string[];
  fixes: readonly string[];
  plan: readonly IPlanStep[];
  withoutFix: IRunOutcome;
  withFix: IRunOutcome;
}): IProofVerdict => {
  if (input.fixes.length === 0) {
    return { proven: false, reason: "The change has no fix, only tests." };
  }

  if (input.tests.length === 0) {
    return { proven: false, reason: "The change has no regression test." };
  }

  if (input.plan.length === 0) {
    return { proven: false, reason: "No test runner for these test files." };
  }

  if (input.withoutFix.code === 127) {
    return { proven: false, reason: "The test runner could not start." };
  }

  if (input.withoutFix.code === 0) {
    return {
      proven: false,
      reason: "The tests pass without the fix, so they do not prove it.",
    };
  }

  if (input.withFix.code !== 0) {
    return { proven: false, reason: "The tests fail with the fix applied." };
  }

  if (skippedIn(input.withFix.log) > 0) {
    return {
      proven: false,
      reason:
        "Some tests were skipped with the fix applied, so they do not prove it.",
    };
  }

  return {
    proven: true,
    reason: "Tests fail on the base code and pass with the fix.",
  };
};

export interface IProveDeps {
  readonly run: ProcessRunner;
  /** The checkout the change lives in. */
  readonly root: string;
}

const COMMAND_TIMEOUT_MS = 10 * 60_000;

/** Runs a command list; its output tail is kept for the report. */
const exec = (
  deps: IProveDeps,
  command: readonly string[],
  cwd: string
): IRunOutcome => {
  const [program = "", ...args] = command;
  const result = deps.run(program, args, {
    cwd,
    timeoutMs: COMMAND_TIMEOUT_MS,
  });

  return {
    code: result.status,
    log: `${result.stdout}${result.stderr}`.slice(-3000),
  };
};

const runPlan = (deps: IProveDeps, plan: readonly IPlanStep[]): IRunOutcome => {
  let code = 0;
  const logs: string[] = [];

  for (const step of plan) {
    const result = exec(deps, step.run, join(deps.root, step.app));

    logs.push(`$ (${step.app}) ${step.run.join(" ")}\n${result.log}`);

    if (result.code !== 0) {
      code = result.code;
    }
  }

  return { code, log: logs.join("\n") };
};

/** Setup for every step; the first failing command is returned as the reason. */
const setupFailure = (
  deps: IProveDeps,
  plan: readonly IPlanStep[]
): { command: string; log: string } | undefined => {
  for (const step of plan) {
    for (const command of step.setup) {
      const result = exec(deps, command, join(deps.root, step.app));

      if (result.code !== 0) {
        return { command: command.join(" "), log: result.log };
      }
    }
  }

  return undefined;
};

const gitLines = (deps: IProveDeps, args: readonly string[]): string[] => {
  const result = deps.run("git", args, { cwd: deps.root });

  if (result.status !== 0) {
    throw new Error(
      `git ${args[0] ?? ""} failed: ${result.stderr.trim().slice(0, 200)}`
    );
  }

  return result.stdout.split("\n").filter((line) => line !== "");
};

export interface IProofReport extends IProofVerdict {
  readonly tests: readonly string[];
  readonly fixes: readonly string[];
  readonly plan: readonly string[];
  readonly log?: string;
  readonly withoutFix?: string;
  readonly withFix?: string;
}

/**
 * Proves the change at `deps.root` against HEAD. Returns the report; the
 * caller writes it. Throws only when git itself fails.
 */
export const proveFix = (
  changed: readonly string[],
  deps: IProveDeps
): IProofReport => {
  const { tests, fixes } = splitChange(changed);
  const plan = testPlan(tests);
  const base = { tests, fixes, plan: plan.map((step) => step.run.join(" ")) };

  if (fixes.length === 0 || tests.length === 0 || plan.length === 0) {
    return {
      ...base,
      ...proofVerdict({
        tests,
        fixes,
        plan,
        withoutFix: { code: 1, log: "" },
        withFix: { code: 0, log: "" },
      }),
    };
  }

  const setupError = setupFailure(deps, plan);

  if (setupError !== undefined) {
    return {
      ...base,
      proven: false,
      reason: `Setup failed: ${setupError.command}`,
      log: setupError.log,
    };
  }

  const tracked = new Set(
    gitLines(deps, ["ls-tree", "-r", "--name-only", "HEAD", "--", ...fixes])
  );
  const backup = mkdtempSync(join(tmpdir(), "prove-fix-"));
  let withoutFix: IRunOutcome;

  try {
    for (const path of fixes) {
      const source = join(deps.root, path);

      if (existsSync(source)) {
        const target = join(backup, path);

        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(source, target);
      }

      if (tracked.has(path)) {
        gitLines(deps, ["checkout", "HEAD", "--", path]);
      } else {
        rmSync(source, { force: true });
      }
    }

    withoutFix = runPlan(deps, plan);
  } finally {
    for (const path of fixes) {
      const saved = join(backup, path);
      const target = join(deps.root, path);

      if (existsSync(saved)) {
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(saved, target);
      } else {
        rmSync(target, { force: true });
      }
    }

    rmSync(backup, { recursive: true, force: true });
  }

  const withFix = runPlan(deps, plan);
  const verdict = proofVerdict({ tests, fixes, plan, withoutFix, withFix });

  return {
    ...base,
    ...verdict,
    withoutFix: withoutFix.log,
    withFix: withFix.log,
  };
};
