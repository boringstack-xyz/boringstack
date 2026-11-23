/*
 * `factory browse [--base-url <url>]`: opens every route of the app signed in
 * (a fresh verified user), and fails on a page error, a console error, a 5xx
 * or a failed /api/ call. Routes come from the robot's coverage list, so a new
 * page is opened here the moment the robot covers it.
 */
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { ROBOT_COVERAGE } from "../../../apps/ui/e2e/robot/coverage";
import { nowIso } from "../clock";
import type { IFactoryContext } from "../context";
import { slotOfWorkspace } from "../fleet/logs";
import { blocked, failed, ok, type ICommandOutcome } from "../result";
import { writeJson } from "../state";
import {
  baseUrlFor,
  buildReport,
  catalogOf,
  runIdOf,
  summaryLines,
  type IBrowseReport,
} from "./browse.utils";
import {
  type ICredentials,
  visitRoutes,
  type IVisitInput,
  type IVisitOutcome,
} from "./browse.playwright";

/** The reserved domain the API treats as the robot's; these accounts can receive no mail. */
export const TEST_EMAIL_DOMAIN = "robot.boringstack.invalid";

const REACHABLE_TIMEOUT_MS = 10_000;

export interface IBrowseDeps {
  readonly now: () => string;
  readonly newUser: () => ICredentials;
  readonly visit: (input: IVisitInput) => Promise<IVisitOutcome>;
  readonly isReachable: (baseUrl: string) => Promise<boolean>;
}

/** A fresh account for one run: a new address and password, never printed. */
export const newUser = (): ICredentials => ({
  email: `browse-${randomUUID()}@${TEST_EMAIL_DOMAIN}`,
  // gitleaks:allow: generated per run for an account on a local stack
  password: `Browse-${randomUUID()}-A1`,
  firstName: "Factory",
  lastName: "Browse",
});

/** Whether the app answers at all, so a run against a stopped stack says so instead of failing every route. */
export const isReachable = async (baseUrl: string): Promise<boolean> => {
  try {
    await fetch(baseUrl, { signal: AbortSignal.timeout(REACHABLE_TIMEOUT_MS) });

    return true;
  } catch {
    return false;
  }
};

export const defaultBrowseDeps: IBrowseDeps = {
  now: nowIso,
  newUser,
  visit: visitRoutes,
  isReachable,
};

/** The `--base-url` flag: its value, null when absent, or the reason the flags do not read. */
export const parseBaseUrl = (
  args: readonly string[],
  allowPositionals = false
): { readonly value: string | null } | { readonly error: string } => {
  try {
    const { values } = parseArgs({
      args: [...args],
      strict: true,
      allowPositionals,
      options: { "base-url": { type: "string" } },
    });
    const value = values["base-url"] ?? null;

    return value === null || /^https?:\/\//u.test(value)
      ? { value }
      : { error: "--base-url must start with http:// or https://" };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

export const browseRun = async (
  args: readonly string[],
  context: IFactoryContext,
  deps: IBrowseDeps = defaultBrowseDeps
): Promise<ICommandOutcome> => {
  const explicit = parseBaseUrl(args);

  if ("error" in explicit) {
    return failed(explicit.error);
  }

  const baseUrl = baseUrlFor(context, explicit.value, slotOfWorkspace(context));

  if (baseUrl === null) {
    return blocked(
      "This workspace has no stack to open. Start one first, or pass --base-url <url>."
    );
  }

  if (!(await deps.isReachable(baseUrl))) {
    return blocked(
      `The stack at ${baseUrl} is not answering. Start it, then run this again.`
    );
  }

  const catalog = catalogOf(Object.keys(ROBOT_COVERAGE));
  const startedAt = deps.now();
  const runId = runIdOf(startedAt);
  const outDir = join(context.stateDir, "browse", runId);
  let outcome: IVisitOutcome;

  try {
    outcome = await deps.visit({
      uiRoot: join(context.root, "apps", "ui"),
      baseUrl,
      routes: catalog.open,
      outDir,
      user: deps.newUser(),
    });
  } catch (error: unknown) {
    return blocked(
      `The browser could not run: ${error instanceof Error ? error.message : String(error)}. Install the app's dependencies (bun install in apps/ui).`
    );
  }

  const report: IBrowseReport = buildReport({
    runId,
    baseUrl,
    startedAt,
    finishedAt: deps.now(),
    signedIn: outcome.signInError === null,
    routes: outcome.routes,
    skipped: catalog.skipped,
  });

  writeJson(join(outDir, "browse.json"), report);

  if (outcome.signInError !== null) {
    return blocked(
      `Could not sign in on the stack: ${outcome.signInError}. Nothing was opened.`,
      report
    );
  }

  const lines = summaryLines(report);

  return report.ok
    ? ok(lines.join("\n"), report)
    : failed(lines.join("\n"), report);
};
