/*
 * `factory walk <scenario-file> [--base-url <url>]`: runs a walkthrough from
 * apps/ui/e2e/walkthroughs with Playwright (apps/ui's own install), a
 * screenshot after every step, and prints the list for the verification
 * record's "Walked in browser" section.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";

import { nowIso } from "../clock";
import type { IFactoryContext } from "../context";
import { slotOfWorkspace } from "../fleet/logs";
import { blocked, failed, ok, type ICommandOutcome } from "../result";
import { readJson, writeJson } from "../state";
import { isReachable, parseBaseUrl } from "./browse";
import { baseUrlFor, runIdOf } from "./browse.utils";
import { type ProcessRunner, runProcess } from "../fleet/process";
import {
  parseSteps,
  scenarioArgOf,
  scenarioOf,
  walkedLines,
} from "./walk.utils";

/** A walkthrough is longer than a route check: the time limit allows for each step. */
const WALK_TIMEOUT_MS = 15 * 60_000;

/** The tail of the Playwright output shown when a walkthrough fails. */
const OUTPUT_TAIL_LINES = 40;

export interface IWalkDeps {
  readonly now: () => string;
  readonly run: ProcessRunner;
  readonly isReachable: (baseUrl: string) => Promise<boolean>;
}

export const defaultWalkDeps: IWalkDeps = {
  now: nowIso,
  run: runProcess,
  isReachable,
};

const positionalsOf = (args: readonly string[]): string[] | string => {
  try {
    const { positionals } = parseArgs({
      args: [...args],
      strict: true,
      allowPositionals: true,
      options: { "base-url": { type: "string" } },
    });

    return positionals;
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
};

const tail = (text: string): string =>
  text.trimEnd().split("\n").slice(-OUTPUT_TAIL_LINES).join("\n");

export const walkRun = async (
  args: readonly string[],
  context: IFactoryContext,
  deps: IWalkDeps = defaultWalkDeps
): Promise<ICommandOutcome> => {
  const positionals = positionalsOf(args);

  if (typeof positionals === "string") {
    return failed(positionals);
  }

  const explicit = parseBaseUrl(args, true);

  if ("error" in explicit) {
    return failed(explicit.error);
  }

  const [input] = positionals;

  if (positionals.length !== 1 || input === undefined) {
    return failed(
      "Usage: factory walk <scenario-file> (a file in apps/ui/e2e/walkthroughs)"
    );
  }

  const scenario = scenarioOf(context.root, input);

  if ("error" in scenario) {
    return failed(`Not a walkthrough: ${scenario.error}.`);
  }

  if (!existsSync(scenario.path)) {
    return failed(`No walkthrough at ${input}.`);
  }

  const baseUrl = baseUrlFor(context, explicit.value, slotOfWorkspace(context));

  if (baseUrl === null) {
    return blocked(
      "This workspace has no stack to walk. Start one first, or pass --base-url <url>."
    );
  }

  if (!(await deps.isReachable(baseUrl))) {
    return blocked(
      `The stack at ${baseUrl} is not answering. Start it, then run this again.`
    );
  }

  const uiRoot = join(context.root, "apps", "ui");
  const playwrightCli = join(
    uiRoot,
    "node_modules",
    "@playwright",
    "test",
    "cli.js"
  );

  if (!existsSync(playwrightCli)) {
    return blocked(
      "The app's test tools are not installed. Run bun install in apps/ui."
    );
  }

  const runId = runIdOf(deps.now());
  const walkDir = join(context.stateDir, "walk", runId);
  const folder = relative(context.root, walkDir);

  mkdirSync(walkDir, { recursive: true });

  const result = deps.run(
    "node",
    [
      playwrightCli,
      "test",
      scenarioArgOf(uiRoot, scenario.path),
      "--config",
      join(context.root, "tools", "factory", "browse", "walk.config.ts"),
      "--reporter=list",
    ],
    {
      cwd: uiRoot,
      timeoutMs: WALK_TIMEOUT_MS,
      env: {
        PATH: context.env.path ?? "",
        HOME: context.env.home ?? "",
        FACTORY_WALK_DIR: walkDir,
        FACTORY_BASE_URL: baseUrl,
        FORCE_COLOR: "0",
      },
    }
  );
  const steps = parseSteps(readJson(join(walkDir, "steps.json")));

  writeJson(join(walkDir, "walk.json"), {
    runId,
    scenario: input,
    baseUrl,
    exitCode: result.status,
    steps,
  });

  const lines = walkedLines(steps, folder);

  if (result.status !== 0) {
    return failed(
      [
        `The walkthrough failed (exit ${String(result.status)}).`,
        tail(`${result.stdout}\n${result.stderr}`),
        ...(lines.length > 0
          ? ["Screenshots taken before it failed:", ...lines]
          : []),
      ].join("\n"),
      { runId, steps }
    );
  }

  if (steps.length === 0) {
    return failed(
      "The walkthrough finished but took no screenshots, so it walked nothing.",
      {
        runId,
        steps,
      }
    );
  }

  return ok(
    [
      `Walked in browser (${String(steps.length)} screenshot(s), ${folder}):`,
      ...lines,
    ].join("\n"),
    { runId, steps }
  );
};
