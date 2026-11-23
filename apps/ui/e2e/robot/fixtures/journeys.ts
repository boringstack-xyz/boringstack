import { appendFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * What each journey actually asked the API for. Every request the robot
 * makes passes through ./pace, which records it here against the journey
 * that is running. A passed journey's calls are written to JOURNEYS_FILE, and
 * check-api-coverage.ts (the run's global teardown) fails the run when a
 * journey that e2e/robot/api-coverage.ts says calls an operation never did.
 */
export const JOURNEYS_FILE = join(
  dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))),
  "robot-results",
  "journeys.jsonl"
);

export interface IJourneyRecord {
  readonly title: string;
  readonly calls: readonly string[];
}

let current: string | undefined;
const calls = new Map<string, Set<string>>();

/** Clears the previous run's record. Called from the global setup. */
export function resetJourneys(): void {
  rmSync(JOURNEYS_FILE, { force: true });
}

export function startJourney(title: string): void {
  current = title;
  calls.set(title, calls.get(title) ?? new Set());
}

/** Records one API call against the running journey, as `METHOD /path`. */
export function recordCall(method: string, pathname: string): void {
  if (current !== undefined) {
    calls.get(current)?.add(`${method.toUpperCase()} ${pathname}`);
  }
}

/** Ends the running journey; only a passed one counts as evidence. */
export function endJourney(title: string, passed: boolean): void {
  current = undefined;

  if (!passed) {
    return;
  }

  const record: IJourneyRecord = {
    title,
    calls: [...(calls.get(title) ?? [])]
  };

  mkdirSync(dirname(JOURNEYS_FILE), { recursive: true });
  appendFileSync(JOURNEYS_FILE, `${JSON.stringify(record)}\n`);
}
