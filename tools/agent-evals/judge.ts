import { parseJUnit } from "../../apps/api/scripts/quality/security-manifest-lib";
import { testEvidence } from "../agent/reports";
import type { ICheckResult } from "../agent/result";

export const API_CASES = [
  "control: owner creates, reads and renames within their account",
  "other accounts cannot list, fetch, or rename an owned record",
  "member reads but cannot mutate",
  "viewer reads but cannot mutate",
  "control: admin can create",
  "revoked membership denies an existing session immediately",
  "client ownership fields cannot create data in another account",
  "service boundary rechecks membership independently of the HTTP plugin",
  "client selectors cannot change the session account even for a member of both accounts",
  "unsupported deletion cannot remove a project",
] as const;
export const UI_CASES = [
  "rename sends only the allowed name field to the selected record",
  "without an active account a mutation cannot reach the API",
  "a role change removes writer controls from the mounted page",
  "a failed list becomes an error view rather than a successful empty result",
  "account changes never expose the previous account's cached records",
  "control: returning to the same account uses its own cache",
  "a response for a different account is rejected",
  "successful creation refreshes the active account list",
  "shows an empty state and hides writes from readers",
  "exposes the form to a writer",
  "loading and errors have distinct accessible states",
] as const;
export const MIGRATION_CASES = [
  "control: the migration database is reachable",
  "existing project survives with a nullable description",
] as const;

/** Pin every case, including passing controls; an unrelated red test cannot kill a mutant. */
export function judge(
  id: string,
  xml: string,
  exit: number | null,
  names: readonly string[],
  failures: readonly string[] = []
): ICheckResult {
  const evidence = testEvidence(id, xml, exit);

  if (evidence.status === "blocked") {
    return evidence;
  }

  const cases = parseJUnit(xml);
  const seen = new Set<string>();
  const matches =
    cases.length === names.length &&
    failures.every((name) => names.includes(name)) &&
    cases.every((testCase) => {
      if (seen.has(testCase.name) || !names.includes(testCase.name)) {
        return false;
      }

      seen.add(testCase.name);

      return (
        testCase.outcome ===
        (failures.includes(testCase.name) ? "failed" : "passed")
      );
    });

  return {
    ...evidence,
    status: matches ? "passed" : "failed",
    reason: matches ? "named_cases_match" : "named_cases_disagree",
  };
}
