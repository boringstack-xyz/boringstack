import { existsSync, readFileSync } from "node:fs";

import { ROBOT_API_COVERAGE } from "./api-coverage";
import { type IJourneyRecord, JOURNEYS_FILE } from "./fixtures/journeys";

/*
 * The run's global teardown. e2e/robot/api-coverage.ts claims, for every API
 * operation, the journeys that call it; src/app/router/routes.test.tsx keeps
 * that list complete. This check keeps it true: an operation is a failure
 * when the journeys claiming it passed in this run and none of them called it.
 * A skipped or failed journey proves nothing and is already reported.
 */
const toPattern = (path: string): RegExp =>
  new RegExp(
    `^${path
      .replace(/\/$/u, "")
      .split("/")
      .map((part) =>
        /^\{[^}]+\}$/u.test(part)
          ? "[^/]+"
          : part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
      )
      .join("/")}/?$`,
    "u"
  );

function calledOperation(operation: string, calls: readonly string[]): boolean {
  const [method = "", path = ""] = operation.split(" ");
  const pattern = toPattern(path);

  return calls.some((call) => {
    const [callMethod = "", callPath = ""] = call.split(" ");

    return callMethod === method && pattern.test(callPath);
  });
}

export function unprovenOperations(
  records: readonly IJourneyRecord[]
): string[] {
  const byTitle = new Map(records.map((record) => [record.title, record]));
  const unproven: string[] = [];

  for (const [operation, coverage] of Object.entries(ROBOT_API_COVERAGE)) {
    const ran = (coverage.journeys ?? [])
      .map((title) => byTitle.get(title))
      .filter((record) => record !== undefined);

    if (
      ran.length > 0 &&
      !ran.some((record) => calledOperation(operation, record.calls))
    ) {
      unproven.push(
        `${operation}: claimed by ${ran.map((record) => `"${record.title}"`).join(", ")}, which never called it`
      );
    }
  }

  return unproven;
}

export default function checkApiCoverage(): void {
  if (!existsSync(JOURNEYS_FILE)) {
    return;
  }

  const records = readFileSync(JOURNEYS_FILE, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as IJourneyRecord);
  const unproven = unprovenOperations(records);

  if (unproven.length > 0) {
    throw new Error(
      `The robot's API coverage list is not true for this run (e2e/robot/api-coverage.ts):\n${unproven.join("\n")}`
    );
  }
}
