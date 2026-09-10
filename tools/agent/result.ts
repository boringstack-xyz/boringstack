const INVALID_EVIDENCE = "Invalid verification evidence";

/** Versioned evidence for a declared check, never a production certification. */
export type Status = "passed" | "failed" | "blocked" | "not_applicable";

export interface ICheckResult {
  checkId: string;
  durationMs?: number;
  cases?: { passed: number; failed: number; skipped: number };
  status: Status;
  reason: string;
}

export interface IVerificationResult {
  schemaVersion: 1;
  runId: string;
  profile: string;
  startedAt: string;
  finishedAt: string;
  checkout: { commit: string; fingerprint: string } | null;
  source: "caller-selected-api" | "owned-sandbox" | "checkout";
  status: Status;
  checks: ICheckResult[];
}

export const exitCode = (status: Status): number =>
  status === "passed" || status === "not_applicable"
    ? 0
    : status === "failed"
      ? 1
      : 2;

/** Missing, mixed, malformed or contradictory output is not passing evidence. */
export function parseEvidence(stdout: string, code: number): ICheckResult {
  try {
    const value: unknown = JSON.parse(stdout);

    if (typeof value !== "object" || value === null) {
      throw new Error(INVALID_EVIDENCE);
    }

    if (!("schemaVersion" in value) || value.schemaVersion !== 1) {
      throw new Error(INVALID_EVIDENCE);
    }

    if (!("checkId" in value) || value.checkId !== "openapi.drift") {
      throw new Error(INVALID_EVIDENCE);
    }

    if (!("status" in value) || !("reason" in value)) {
      throw new Error(INVALID_EVIDENCE);
    }

    const status = value.status;

    if (status !== "passed" && status !== "failed" && status !== "blocked") {
      throw new Error(INVALID_EVIDENCE);
    }

    const reasons = {
      passed: ["schema_matches"],
      failed: ["schema_missing", "schema_drift"],
      blocked: [
        "openapi_unavailable_or_invalid",
        "generator_error",
        "json_requires_check_mode",
      ],
    };

    if (
      typeof value.reason !== "string" ||
      !reasons[status].includes(value.reason)
    ) {
      throw new Error(INVALID_EVIDENCE);
    }

    if (exitCode(status) !== code) {
      throw new Error(INVALID_EVIDENCE);
    }

    return { checkId: "openapi.drift", status, reason: value.reason };
  } catch {
    return {
      checkId: "openapi.drift",
      status: "blocked",
      reason: "invalid_check_report",
    };
  }
}
