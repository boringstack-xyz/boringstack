import { parseJUnit } from "../../apps/api/scripts/quality/security-manifest-lib";
import type { ICheckResult } from "./result";

export function testEvidence(
  id: string,
  xml: string,
  exit: number | null,
  runner: "bun" | "playwright" = "bun",
  completeGateFailure = false
): ICheckResult {
  const structural = xml
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const safeXml = xml.replace(
    /<!\[CDATA\[([\s\S]*?)\]\]>/g,
    (_, text: string) =>
      text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
  );
  const cases = parseJUnit(safeXml);
  const count = (structural.match(/<testcase\b/g) ?? []).length;

  if (
    !xml.includes("<testsuites") ||
    !xml.includes("</testsuites>") ||
    count === 0 ||
    cases.length !== count ||
    /<error\b/.test(structural)
  ) {
    return { checkId: id, status: "blocked", reason: "invalid_test_report" };
  }

  if (
    runner === "playwright" &&
    !cases.some((testCase) => testCase.outcome === "failed") &&
    /\[\[ATTACHMENT\||<flakyFailure\b|<rerunFailure\b/.test(xml)
  ) {
    return {
      checkId: id,
      status: "blocked",
      reason: "browser_retry_or_attachment_requires_review",
    };
  }

  const totals = {
    passed: cases.filter((testCase) => testCase.outcome === "passed").length,
    failed: cases.filter((testCase) => testCase.outcome === "failed").length,
    skipped: cases.filter((testCase) => testCase.outcome === "skipped").length,
  };
  const infrastructure = cases.some(
    (testCase) =>
      testCase.outcome === "failed" &&
      (runner === "playwright"
        ? (!/^expect\.[a-zA-Z][a-zA-Z0-9]*$/.test(testCase.failureType ?? "") &&
            testCase.failureType !== "AssertionError") ||
          /<failure\b[^>]*\bmessage="[^"]*SPEC-INFRA/.test(xml)
        : testCase.failureType !== "AssertionError" ||
          testCase.failureMessage?.includes("SPEC-INFRA") === true)
  );

  if (
    infrastructure ||
    totals.skipped > 0 ||
    exit === null ||
    (exit === 0 && totals.failed > 0) ||
    (exit !== 0 && totals.failed === 0 && !completeGateFailure)
  ) {
    return {
      checkId: id,
      status: "blocked",
      reason: "incomplete_test_execution",
      cases: totals,
    };
  }

  return {
    checkId: id,
    status: totals.failed > 0 || exit !== 0 ? "failed" : "passed",
    reason:
      totals.failed > 0
        ? "test_assertions_failed"
        : exit !== 0
          ? "product_gate_failed"
          : "tests_passed",
    cases: totals,
  };
}
