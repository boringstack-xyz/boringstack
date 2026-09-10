/**
 * Tests for the security-spec manifest reconciler.
 *
 * The first version of this checker classified findings by grepping the test
 * runner's text output for `(fail) Fxx`. That accepted a database setup
 * exception as proof of a vulnerability, and accepted a skipped test as proof
 * of a fix: false-green in both directions, in the one component whose job is
 * to prevent false-green. These cases pin each of those behaviours.
 *
 * Lives in `tests/` rather than `security-spec/` on purpose: the reconciler is
 * ordinary code and must be green, unlike the specs it reconciles.
 */
import { describe, expect, test } from "bun:test";

import {
  checkStructure,
  INFRA_MARKER,
  parseJUnit,
  reconcile,
  type IFinding,
  type IManifest,
  type ITestCase,
} from "../../scripts/quality/security-manifest-lib";

const FILE = "f01-example.test.ts";
const DEFECT = "the defect is present";
const ANOTHER = "another aspect of the defect";
const FAIL = "assertion-fail" as const;
const PASS = "pass" as const;
const CONTROL = "control: the fixture works";
const REFUTED_FILE = "f02-refuted.test.ts";

const finding = (overrides: Partial<IFinding> = {}): IFinding => ({
  id: "F01",
  severity: "high",
  status: "proven",
  file: FILE,
  title: "example",
  cases: { [DEFECT]: FAIL, [CONTROL]: PASS },
  ...overrides,
});

const manifestOf = (...findings: IFinding[]): IManifest => ({
  reviewedCommit: "deadbeef",
  findings,
});

const assertionFailure = (name: string): ITestCase => ({
  file: FILE,
  name,
  outcome: "failed",
  failureType: "AssertionError",
  failureMessage: "expect(received).toBe(expected)",
});

const passing = (name: string): ITestCase => ({
  file: FILE,
  name,
  outcome: "passed",
});

const run = (cases: ITestCase[], findings = [finding()]): string[] =>
  reconcile({ manifest: manifestOf(...findings), cases, runCompleted: true });

describe("security manifest reconciler", () => {
  test("accepts a proven finding with a real assertion failure", () => {
    const problems = run([assertionFailure(DEFECT), passing(CONTROL)]);

    expect(problems).toBeEmpty();
  });

  /* ------------------------------------------- the two original false-greens */

  test("rejects a setup failure dressed up as evidence", () => {
    const problems = run([
      {
        file: FILE,
        name: DEFECT,
        outcome: "failed",
        failureType: "Error",
        failureMessage: "connect ECONNREFUSED 127.0.0.1:5432",
      },
      passing(CONTROL),
    ]);

    expect(problems).not.toBeEmpty();
    expect(problems.join("\n")).toContain("rather than an assertion");
  });

  test("rejects an infra failure even when it arrives as an AssertionError", () => {
    const problems = run([
      {
        file: FILE,
        name: DEFECT,
        outcome: "failed",
        failureType: "AssertionError",
        failureMessage: `${INFRA_MARKER}: owner membership missing from fixture`,
      },
      passing(CONTROL),
    ]);

    expect(problems.join("\n")).toContain("rather than an assertion");
  });

  test("rejects a skipped test", () => {
    const problems = run([
      { file: FILE, name: DEFECT, outcome: "skipped" },
      passing(CONTROL),
    ]);

    expect(problems.join("\n")).toContain("was skipped");
  });

  test("rejects a `fixed` finding whose tests never ran", () => {
    const problems = reconcile({
      manifest: manifestOf(finding({ status: "fixed" })),
      cases: [],
      runCompleted: true,
    });

    expect(problems.join("\n")).toContain("executed no tests at all");
  });

  /* ------------------------------------------------------ the other direction */

  test("rejects a proven finding whose tests all pass", () => {
    const problems = run([passing(DEFECT), passing(CONTROL)]);

    expect(problems.join("\n")).toContain('marked "proven"');
  });

  test("accepts a fixed finding whose tests all pass", () => {
    const problems = run(
      [passing(DEFECT), passing(CONTROL)],
      [
        finding({
          status: "fixed",
          cases: { [DEFECT]: PASS, [CONTROL]: PASS },
        }),
      ]
    );

    expect(problems).toBeEmpty();
  });

  test("rejects a fixed finding that still fails", () => {
    const problems = run(
      [assertionFailure(DEFECT), passing(CONTROL)],
      [
        finding({
          status: "fixed",
          cases: { [DEFECT]: PASS, [CONTROL]: PASS },
        }),
      ]
    );

    expect(problems.join("\n")).toContain('marked "fixed"');
  });

  /* ------------------------------------------------------ controls and counts */

  test("rejects a failing positive control", () => {
    const problems = run([assertionFailure(DEFECT), assertionFailure(CONTROL)]);

    expect(problems.join("\n")).toContain("control");
  });

  test("a failing control alone is not evidence for the finding", () => {
    const problems = run([passing(DEFECT), assertionFailure(CONTROL)]);

    // Both the control failure and the missing evidence must be reported.
    expect(problems.join("\n")).toContain("control");
    expect(problems.join("\n")).toContain('marked "proven"');
  });

  test("rejects a missing test case", () => {
    const problems = run([passing(CONTROL)]);

    expect(problems.join("\n")).toContain('expected case "' + DEFECT + '"');
  });

  test("rejects a finding with no positive control at all", () => {
    const problems = run(
      [assertionFailure(DEFECT)],
      [finding({ cases: { [DEFECT]: FAIL } })]
    );

    expect(problems.join("\n")).toContain("no positive control");
  });

  /* ------------------------------------------------- per-case expectations */

  test("rejects a partially fixed finding while another case still fails", () => {
    /*
     * The aggregate check accepted this: one non-control assertion failure
     * was enough to call the finding proven, so a second case could go green
     * unnoticed.
     */
    const second = ANOTHER;
    const problems = run(
      [assertionFailure(DEFECT), passing(second), passing(CONTROL)],
      [
        finding({
          cases: {
            [DEFECT]: FAIL,
            [second]: FAIL,
            [CONTROL]: PASS,
          },
        }),
      ]
    );

    expect(problems.join("\n")).toContain(`"${second}" was expected to`);
  });

  test("rejects a previously passing non-control case that goes red", () => {
    const negative = "a legitimate request is unaffected";
    const problems = run(
      [assertionFailure(DEFECT), assertionFailure(negative), passing(CONTROL)],
      [
        finding({
          cases: {
            [DEFECT]: FAIL,
            [negative]: PASS,
            [CONTROL]: PASS,
          },
        }),
      ]
    );

    expect(problems.join("\n")).toContain(`"${negative}" was expected to pass`);
  });

  test("rejects a case that ran but is not in the manifest", () => {
    const problems = run([
      assertionFailure(DEFECT),
      passing(CONTROL),
      passing("a case nobody recorded"),
    ]);

    expect(problems.join("\n")).toContain("not listed in the");
  });

  test("rejects duplicate case names", () => {
    const problems = run([
      assertionFailure(DEFECT),
      assertionFailure(DEFECT),
      passing(CONTROL),
    ]);

    expect(problems.join("\n")).toContain("must be unique");
  });

  test("rejects a run that produced no report", () => {
    const problems = reconcile({
      manifest: manifestOf(finding()),
      cases: [],
      runCompleted: false,
    });

    expect(problems.join("\n")).toContain("no report");
  });

  /* ------------------------------------------------- refuted accounting */

  test("accepts a refuted finding with no cases and nothing running", () => {
    const problems = reconcile({
      manifest: manifestOf(
        finding(),
        finding({
          id: "F02",
          status: "refuted",
          file: REFUTED_FILE,
          cases: {},
        })
      ),
      cases: [assertionFailure(DEFECT), passing(CONTROL)],
      runCompleted: true,
    });

    /*
     * The shape a refuted finding is supposed to have: the metadata stays
     * so the review reads, and nothing executable is left behind it.
     */
    expect(problems).toBeEmpty();
  });

  test("rejects a refuted finding that still lists expectations", () => {
    const problems = reconcile({
      manifest: manifestOf(
        finding(),
        finding({
          id: "F02",
          status: "refuted",
          file: REFUTED_FILE,
          cases: { [DEFECT]: FAIL },
        })
      ),
      cases: [assertionFailure(DEFECT), passing(CONTROL)],
      runCompleted: true,
    });

    expect(problems.join("\n")).toContain("F02 is refuted but still lists");
  });

  test("rejects passing cases that belong to a refuted finding", () => {
    const problems = reconcile({
      manifest: manifestOf(
        finding(),
        finding({
          id: "F02",
          status: "refuted",
          file: REFUTED_FILE,
          cases: {},
        })
      ),
      cases: [
        assertionFailure(DEFECT),
        passing(CONTROL),
        { file: REFUTED_FILE, name: "still here", outcome: "passed" },
      ],
      runCompleted: true,
    });

    /*
     * Reconciliation skips refuted findings, so anything running from one
     * is accounted for by nothing at all: it can pass, fail, or stop
     * running, and the check stays green either way.
     */
    expect(problems.join("\n")).toContain('"still here" ran from');
  });

  test("rejects failing cases that belong to a refuted finding", () => {
    const problems = reconcile({
      manifest: manifestOf(
        finding(),
        finding({
          id: "F02",
          status: "refuted",
          file: REFUTED_FILE,
          cases: {},
        })
      ),
      cases: [
        assertionFailure(DEFECT),
        passing(CONTROL),
        {
          file: REFUTED_FILE,
          name: "the defect is back",
          outcome: "failed",
          failureType: "AssertionError",
          failureMessage: "expect(received).toBe(expected)",
        },
      ],
      runCompleted: true,
    });

    expect(problems.join("\n")).toContain('"the defect is back" ran from');
  });

  test("rejects cases from a file no finding maps to", () => {
    const problems = reconcile({
      manifest: manifestOf(finding()),
      cases: [
        assertionFailure(DEFECT),
        passing(CONTROL),
        { file: "f99-stray.test.ts", name: "orphan", outcome: "passed" },
      ],
      runCompleted: true,
    });

    expect(problems.join("\n")).toContain(
      "f99-stray.test.ts executed tests but no active finding"
    );
  });
});

describe("security manifest structure", () => {
  const structure = (findings: IFinding[], specFiles: string[]): string[] =>
    checkStructure({ manifest: manifestOf(...findings), specFiles });

  test("accepts a live finding whose file exists", () => {
    expect(structure([finding()], [FILE])).toBeEmpty();
  });

  test("accepts a refuted finding with no cases and no file", () => {
    const problems = structure(
      [
        finding(),
        finding({
          id: "F02",
          status: "refuted",
          file: REFUTED_FILE,
          cases: {},
        }),
      ],
      [FILE]
    );

    expect(problems).toBeEmpty();
  });

  test("rejects a refuted finding whose spec file still exists", () => {
    const problems = structure(
      [
        finding(),
        finding({
          id: "F02",
          status: "refuted",
          file: REFUTED_FILE,
          cases: {},
        }),
      ],
      [FILE, REFUTED_FILE]
    );

    /*
     * Counting a refuted finding's file as mapped was the hole: the file
     * passed the "every spec file belongs to a finding" sweep, and then
     * reconciliation skipped the finding that claimed it.
     */
    expect(problems.join("\n")).toContain("F02 is refuted but");
    expect(problems.join("\n")).toContain("still exists");
  });

  test("rejects a refuted finding that kept its expectations", () => {
    const problems = structure(
      [
        finding(),
        finding({
          id: "F02",
          status: "refuted",
          file: REFUTED_FILE,
          cases: { [DEFECT]: FAIL },
        }),
      ],
      [FILE]
    );

    expect(problems.join("\n")).toContain("must be {}");
  });

  test("rejects a live finding whose file is missing", () => {
    expect(structure([finding()], []).join("\n")).toContain("is missing");
  });

  test("rejects a spec file no finding points at", () => {
    const problems = structure([finding()], [FILE, "f99-stray.test.ts"]);

    expect(problems.join("\n")).toContain("f99-stray.test.ts exists but");
  });
});

describe("JUnit parsing", () => {
  test("reads name, file, outcome and failure type", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="bun test" tests="3">
  <testsuite name="security-spec/f01-example.test.ts" file="security-spec/f01-example.test.ts">
    <testsuite name="F01 example" file="security-spec/f01-example.test.ts">
      <testcase name=DEFECT file="security-spec/f01-example.test.ts">
        <failure type="AssertionError" message="expect(received).toBe(expected)">AssertionError: boom</failure>
      </testcase>
      <testcase name=CONTROL file="security-spec/f01-example.test.ts" />
      <testcase name="conditional" file="security-spec/f01-example.test.ts">
        <skipped />
      </testcase>
    </testsuite>
  </testsuite>
</testsuites>`;

    const cases = parseJUnit(xml);

    expect(cases).toHaveLength(3);
    expect(cases[0]?.file).toBe("f01-example.test.ts");
    expect(cases[0]?.outcome).toBe("failed");
    expect(cases[0]?.failureType).toBe("AssertionError");
    expect(cases[1]?.outcome).toBe("passed");
    expect(cases[2]?.outcome).toBe("skipped");
  });

  test("decodes escaped failure text so markers are detectable", () => {
    const xml = `<testcase name="x" file="a/f01-example.test.ts">
      <failure type="Error" message="m">${INFRA_MARKER}: no Postgres&#10;line two</failure>
    </testcase>`;

    const [only] = parseJUnit(xml);

    expect(only?.failureMessage).toContain(INFRA_MARKER);
    expect(only?.failureMessage).toContain("\n");
  });
});
