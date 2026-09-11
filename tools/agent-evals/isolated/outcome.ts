import { isRecord } from "../../agent/validation";

const REQUIRED_CHECKS = [
  "submission",
  "ui-known-good",
  "api.check",
  "ui.check",
  "projects.browser",
];

/** Process success alone cannot certify a candidate; require complete reviewer evidence too. */
export function candidateOutcome(stdout: string, exit: number | null): number {
  const line = stdout.trim().split("\n").at(-1);
  let value: unknown;

  try {
    value = JSON.parse(line ?? "");
  } catch {
    return 2;
  }

  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.kind !== "candidate-review" ||
    !Array.isArray(value.checks)
  ) {
    return 2;
  }

  const checks: unknown[] = value.checks;

  if (
    checks.length !== REQUIRED_CHECKS.length ||
    !REQUIRED_CHECKS.every(
      (id) =>
        checks.filter(
          (check) =>
            isRecord(check) &&
            check.checkId === id &&
            (check.status === "passed" || check.status === "failed")
        ).length === 1
    )
  ) {
    return 2;
  }

  const failed = checks.some(
    (check) => isRecord(check) && check.status === "failed"
  );

  if (exit === 0 && value.status === "passed" && !failed) {
    return 0;
  }

  return exit === 1 && value.status === "failed" && failed ? 1 : 2;
}
