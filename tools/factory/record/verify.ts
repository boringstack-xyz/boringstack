import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { nowIso } from "../clock";
import type { IFactoryContext } from "../context";
import { childEnvironment } from "../environment";
import { git } from "../git";
import { blocked, failed, type ICommandOutcome, ok } from "../result";
import { isRecord, parseStringRecord, readJson, writeJson } from "../state";
import {
  changedSince,
  fingerprintAll,
  type IRecipe,
  type IUnit,
  type UnitStates,
  unitByPath,
  UNITS,
} from "./units";

/*
 * `factory verify`: runs each changed unit's recipe once, compares a failure
 * with the base commit (a check that also fails there is a warning, not this
 * change's fault), and records the units that passed at their current
 * fingerprint in green.json. A unit that changed during its own run is not
 * recorded: the pass described other code.
 */
export type RecipeStatus = "passed" | "failed" | "warn" | "blocked";

export interface IRecipeRun {
  readonly recipe: string;
  readonly units: readonly string[];
  readonly status: RecipeStatus;
  readonly failures: readonly string[];
  readonly summary: string;
  readonly log: string;
}

export interface IVerifyRun {
  readonly runId: string;
  readonly base: string;
  readonly commit: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly status: RecipeStatus;
  readonly runs: readonly IRecipeRun[];
}

export const greenFile = (context: IFactoryContext): string =>
  join(context.stateDir, "green.json");

export const latestFile = (context: IFactoryContext): string =>
  join(context.stateDir, "verify", "latest.json");

export const readGreen = (context: IFactoryContext): UnitStates =>
  parseStringRecord(readJson(greenFile(context))) ?? {};

/** The commit this branch is compared with: where it left the default branch. */
export const baseCommit = (root: string): string =>
  git(root, ["merge-base", "HEAD", "origin/main"]) ??
  git(root, ["merge-base", "HEAD", "main"]) ??
  "HEAD";

const run = (
  argv: readonly string[],
  cwd: string,
  log: string,
  extraEnv: Readonly<Record<string, string>> = {}
): { code: number; output: string } => {
  const [program = "", ...rest] = argv;
  const result = spawnSync(program, rest, {
    cwd,
    env: childEnvironment(extraEnv),
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  const output = `${result.stdout}\n${result.stderr}`;

  writeFileSync(log, output, { mode: 0o600 });

  return { code: result.status ?? 1, output };
};

/** The sandbox this checkout verifies in: reused while it lives, created when it does not. */
const ensureSandbox = (
  context: IFactoryContext,
  root: string
): string | undefined => {
  const file = join(context.stateDir, "sandbox.json");
  const saved = readJson(file);
  const savedId =
    isRecord(saved) && typeof saved.id === "string" ? saved.id : undefined;

  if (savedId !== undefined) {
    const inspect = spawnSync(
      "bun",
      ["run", "--silent", "sandbox:inspect", "--", `--id=${savedId}`, "--json"],
      { cwd: root, encoding: "utf8" }
    );

    if (inspect.status === 0) {
      return savedId;
    }
  }

  const up = spawnSync(
    "bun",
    ["run", "--silent", "sandbox:up", "--", "--json"],
    {
      cwd: root,
      encoding: "utf8",
    }
  );
  const created: unknown = JSON.parse(
    up.stdout.trim().split("\n").at(-1) ?? "null"
  );
  const id =
    isRecord(created) && typeof created.id === "string"
      ? created.id
      : undefined;

  if (id !== undefined) {
    writeJson(file, { id });
  }

  return id;
};

/** Failed check ids of an agent:verify JSON result. */
const agentFailures = (
  output: string
): { status: string; failures: string[] } => {
  const line = output
    .split("\n")
    .reverse()
    .find((candidate) => candidate.trim().startsWith('{"schemaVersion"'));
  let parsed: unknown;

  try {
    parsed = JSON.parse(line ?? "null");
  } catch {
    parsed = undefined;
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.checks)) {
    return { status: "blocked", failures: ["agent:verify printed no result"] };
  }

  const failures = parsed.checks.flatMap((check: unknown) =>
    isRecord(check) &&
    typeof check.checkId === "string" &&
    check.status !== "passed" &&
    check.status !== "not_applicable"
      ? [`${check.checkId}: ${String(check.status)} (${String(check.reason)})`]
      : []
  );

  return {
    status: typeof parsed.status === "string" ? parsed.status : "blocked",
    failures,
  };
};

/**
 * A checkout lock outlives a verification that was killed (a closed
 * session, a reboot). Say how to clear it, rather than only "blocked".
 */
const withRecoveryHint = (failure: string): string =>
  failure.includes("checkout_locked")
    ? `${failure}; if no verification is running in this checkout, a killed one left the lock: bun run agent:recover -- checkout --acknowledge-partial-writes`
    : failure;

/** Runs one recipe in `root`; failures are what a base comparison matches on. */
const runRecipe = (
  context: IFactoryContext,
  recipe: IRecipe,
  root: string,
  log: string,
  passedRecipes: ReadonlySet<string> = new Set()
): { status: RecipeStatus; failures: string[] } => {
  if (recipe.kind === "agent-verify") {
    const sandbox = ensureSandbox(context, context.root);

    if (sandbox === undefined) {
      return {
        status: "blocked",
        failures: ["no sandbox (is Docker running?)"],
      };
    }

    const result = run(
      [
        "bun",
        "run",
        "--silent",
        "agent:verify",
        "--",
        "--profile=feature",
        `--sandbox=${sandbox}`,
        "--json",
      ],
      root,
      log
    );
    const parsed = agentFailures(result.output);

    return {
      status:
        parsed.status === "passed"
          ? "passed"
          : parsed.status === "failed"
            ? "failed"
            : "blocked",
      failures: parsed.failures.map(withRecoveryHint),
    };
  }

  const covered: Record<string, string> =
    recipe.coveredBy !== undefined && passedRecipes.has(recipe.coveredBy.recipe)
      ? { STACK_CHECK_COVERED: recipe.coveredBy.checks.join(",") }
      : {};
  const result = run(
    recipe.argv ?? [],
    join(root, recipe.cwd ?? "."),
    log,
    covered
  );

  return result.code === 0
    ? { status: "passed", failures: [] }
    : {
        status: "failed",
        failures: [`${recipe.id}: exit ${String(result.code)}`],
      };
};

/** A detached worktree of `base` with dependencies installed, reused across runs. */
const baseWorktree = (
  context: IFactoryContext,
  base: string
): string | undefined => {
  const dir = join(context.stateDir, "base", base.slice(0, 12));

  if (!existsSync(dir)) {
    mkdirSync(join(context.stateDir, "base"), { recursive: true });

    if (
      git(context.root, ["worktree", "add", "--detach", dir, base]) ===
      undefined
    ) {
      return undefined;
    }

    for (const app of [".", "apps/api", "apps/ui", "apps/docs", "apps/site"]) {
      if (existsSync(join(dir, app, "package.json"))) {
        spawnSync("bun", ["install", "--frozen-lockfile", "--ignore-scripts"], {
          cwd: join(dir, app),
          encoding: "utf8",
        });
      }
    }
  }

  return dir;
};

/**
 * Groups units by recipe in UNITS order, whatever order they were asked in:
 * a recipe that covers another's skipped checks (coveredBy) must run first.
 */
const groupByRecipe = (units: readonly IUnit[]): Map<string, IUnit[]> => {
  const groups = new Map<string, IUnit[]>();
  const ordered = [...units].sort(
    (left, right) => UNITS.indexOf(left) - UNITS.indexOf(right)
  );

  for (const unit of ordered) {
    groups.set(unit.recipe.id, [...(groups.get(unit.recipe.id) ?? []), unit]);
  }

  return groups;
};

const overall = (runs: readonly IRecipeRun[]): RecipeStatus => {
  if (runs.some((item) => item.status === "failed")) {
    return "failed";
  }

  if (runs.some((item) => item.status === "blocked")) {
    return "blocked";
  }

  return runs.some((item) => item.status === "warn") ? "warn" : "passed";
};

const isRecipeRun = (value: unknown): value is IRecipeRun =>
  isRecord(value) &&
  typeof value.recipe === "string" &&
  Array.isArray(value.units) &&
  typeof value.status === "string" &&
  typeof value.summary === "string" &&
  typeof value.log === "string";

export interface IVerifyOptions {
  readonly units?: readonly string[];
  readonly compareWithBase: boolean;
}

export const verify = (
  context: IFactoryContext,
  options: IVerifyOptions
): IVerifyRun => {
  const startedAt = nowIso();
  const runId = startedAt.replaceAll(/[:.]/gu, "-");
  const dir = join(context.stateDir, "verify", runId);
  const base = baseCommit(context.root);
  const units =
    options.units === undefined
      ? changedSince(context.root, base)
      : options.units.flatMap((path) => {
          const unit = unitByPath(path);

          return unit === undefined ? [] : [unit];
        });
  const before = fingerprintAll(context.root);
  const runs: IRecipeRun[] = [];

  mkdirSync(dir, { recursive: true });

  for (const [recipeId, group] of groupByRecipe(units)) {
    const recipe = group[0]?.recipe;

    if (recipe === undefined) {
      continue;
    }

    const log = join(dir, `${recipeId}.log`);

    console.error(
      `factory verify: ${recipe.summary} (${group.map((unit) => unit.path).join(", ")})`
    );

    const passedRecipes = new Set(
      runs.filter((item) => item.status === "passed").map((item) => item.recipe)
    );
    const current = runRecipe(
      context,
      recipe,
      context.root,
      log,
      passedRecipes
    );
    let status = current.status;
    let summary = current.failures.join("; ");

    if (status === "failed" && options.compareWithBase) {
      const baseDir = baseWorktree(context, base);
      const atBase =
        baseDir === undefined
          ? undefined
          : runRecipe(
              context,
              recipe,
              baseDir,
              join(dir, `${recipeId}.base.log`),
              passedRecipes
            );

      if (
        atBase !== undefined &&
        current.failures.every((failure) => atBase.failures.includes(failure))
      ) {
        status = "warn";
        summary = `also fails on the base commit ${base.slice(0, 12)}: ${summary}`;
      }
    }

    const after = fingerprintAll(context.root);
    const moved = group.filter(
      (unit) => before[unit.path] !== after[unit.path]
    );

    if (moved.length > 0 && status !== "failed") {
      status = "blocked";
      summary = `changed during the run: ${moved.map((unit) => unit.path).join(", ")}`;
    }

    runs.push({
      recipe: recipeId,
      units: group.map((unit) => unit.path),
      status,
      failures: current.failures,
      summary: summary === "" ? recipe.summary : summary,
      log,
    });
  }

  const passedUnits = runs
    .filter((item) => item.status === "passed" || item.status === "warn")
    .flatMap((item) => item.units);

  if (passedUnits.length > 0) {
    writeJson(greenFile(context), {
      ...readGreen(context),
      ...Object.fromEntries(
        passedUnits.map((path) => [path, before[path] ?? ""])
      ),
    });
  }

  const result: IVerifyRun = {
    runId,
    base,
    commit: git(context.root, ["rev-parse", "HEAD"]) ?? "",
    startedAt,
    finishedAt: nowIso(),
    status: overall(runs),
    runs,
  };

  writeJson(join(dir, "result.json"), result);
  writeJson(latestFile(context), result);

  return result;
};

/** Plain lines for a record's "Checks run" section and for people. */
export const describeRun = (result: IVerifyRun): string =>
  [
    `factory verify ${result.runId} at ${result.commit.slice(0, 12)} (base ${result.base.slice(0, 12)}): ${result.status}`,
    ...result.runs.map(
      (item) =>
        `- ${item.recipe} [${item.units.join(", ")}]: ${item.status}${item.status === "passed" ? "" : `: ${item.summary}`}`
    ),
  ].join("\n");

export const verifyCommand = (
  args: readonly string[],
  context: IFactoryContext
): Promise<ICommandOutcome> => {
  const unitsArg = args.find((arg) => arg.startsWith("--units="))?.slice(8);
  const result = verify(context, {
    units: unitsArg?.split(",").filter((path) => path !== ""),
    compareWithBase: !args.includes("--no-base"),
  });
  const text =
    result.runs.length === 0
      ? "nothing changed since the base commit; nothing to verify"
      : describeRun(result);

  if (result.status === "failed") {
    return Promise.resolve(
      failed(
        `${text}\nlogs: ${result.runs.map((item) => item.log).join(" ")}`,
        result
      )
    );
  }

  if (result.status === "blocked") {
    return Promise.resolve(blocked(text, result));
  }

  return Promise.resolve(ok(text, result));
};

/** Last run's failures for the stop gate, in plain words. */
export const latestRun = (context: IFactoryContext): IVerifyRun | undefined => {
  const parsed = readJson(latestFile(context));

  if (!isRecord(parsed) || !Array.isArray(parsed.runs)) {
    return undefined;
  }

  const status = parsed.status;

  return status === "passed" ||
    status === "failed" ||
    status === "warn" ||
    status === "blocked"
    ? {
        runId: String(parsed.runId),
        base: String(parsed.base),
        commit: String(parsed.commit),
        startedAt: String(parsed.startedAt),
        finishedAt: String(parsed.finishedAt),
        status,
        runs: parsed.runs.filter(isRecipeRun),
      }
    : undefined;
};
