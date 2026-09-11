import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  checkStructure,
  parseJUnit,
  reconcile,
  type CaseExpectation,
  type IFinding,
  type IManifest,
} from "../../apps/api/scripts/quality/security-manifest-lib";
import type { ICheckResult } from "./result";
import { isRecord, parseRecord } from "./validation";

function readFinding(value: unknown): IFinding {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.severity !== "string" ||
    typeof value.file !== "string" ||
    typeof value.title !== "string" ||
    !isRecord(value.cases)
  ) {
    throw new Error("Invalid security finding");
  }

  if (
    value.status !== "proven" &&
    value.status !== "fixed" &&
    value.status !== "refuted"
  ) {
    throw new Error("Invalid security finding status");
  }

  const cases: Record<string, CaseExpectation> = {};

  for (const [name, expectation] of Object.entries(value.cases)) {
    if (expectation !== "assertion-fail" && expectation !== "pass") {
      throw new Error("Invalid security case expectation");
    }

    cases[name] = expectation;
  }

  return {
    id: value.id,
    severity: value.severity,
    file: value.file,
    title: value.title,
    status: value.status,
    cases,
  };
}

export function securityManifestEvidence(
  root: string,
  xml: string,
  runCompleted: boolean
): ICheckResult {
  try {
    const directory = join(root, "apps/api/security-spec");
    const value = parseRecord(
      readFileSync(join(directory, "findings.json"), "utf8")
    );

    if (
      typeof value.reviewedCommit !== "string" ||
      !Array.isArray(value.findings)
    ) {
      throw new Error("Invalid security manifest");
    }

    const manifest: IManifest = {
      reviewedCommit: value.reviewedCommit,
      findings: value.findings.map(readFinding),
    };
    const specFiles = [
      ...new Bun.Glob("*.test.ts").scanSync({ cwd: directory }),
    ];
    const problems = [
      ...checkStructure({ manifest, specFiles }),
      ...reconcile({ manifest, cases: parseJUnit(xml), runCompleted }),
    ];

    return {
      checkId: "security.manifest",
      status: problems.length > 0 ? "failed" : "passed",
      reason: problems.length > 0 ? "manifest_disagrees" : "manifest_matches",
    };
  } catch {
    return {
      checkId: "security.manifest",
      status: "blocked",
      reason: "invalid_manifest",
    };
  }
}
