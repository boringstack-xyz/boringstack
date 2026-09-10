/**
 * Pure reconciliation logic for the security spec manifest.
 *
 * Split out of the runner so it can be unit-tested against synthetic reports.
 * The first version of this checker classified a finding by grepping the
 * runner's text output for `(fail) Fxx`, which accepted a database setup
 * exception as proof of a vulnerability and accepted a skipped test as proof
 * of a fix. Both directions were false-green, in a checker whose entire job is
 * to prevent false-green.
 *
 * The rules below are therefore explicit about *why* a test failed. Only an
 * assertion failure counts as evidence; anything else — a thrown fixture
 * error, an unreachable dependency, a skip, a test that did not run at all —
 * is an infrastructure problem and fails the check outright.
 */

/** Marker used by the harness and fixtures for non-assertion failures. */
export const INFRA_MARKER = "SPEC-INFRA";

export type FindingStatus = "proven" | "fixed" | "refuted";

/** What a single named case is expected to do on a run. */
export type CaseExpectation = "assertion-fail" | "pass";

export interface IFinding {
  readonly id: string;
  readonly severity: string;
  readonly status: FindingStatus;
  readonly file: string;
  readonly title: string;
  /**
   * Expected outcome per test name.
   *
   * Counts alone were not enough. A finding needed only one non-control
   * assertion failure to be accepted as "proven", so a second case could be
   * fixed, or could quietly stop exercising its condition, and the finding
   * still reconciled. Naming every case makes a partial change visible.
   */
  readonly cases: Readonly<Record<string, CaseExpectation>>;
}

export interface IManifest {
  readonly reviewedCommit: string;
  readonly findings: IFinding[];
}

export interface ITestCase {
  readonly file: string;
  readonly name: string;
  readonly outcome: "passed" | "failed" | "skipped";
  /** JUnit failure `type`, e.g. "AssertionError". Absent when passing. */
  readonly failureType?: string;
  readonly failureMessage?: string;
}

const isControl = (testCase: ITestCase): boolean =>
  testCase.name.trimStart().toLowerCase().startsWith("control:");

/**
 * An assertion failure is evidence. Anything else is a broken test.
 *
 * Bun tags genuine `expect` failures as `AssertionError`; a thrown fixture
 * error arrives with the thrown type instead. The marker check catches the
 * case where a fixture deliberately raises an infrastructure error that Bun
 * still reports as an AssertionError (for instance via `expect().toBe()` on a
 * precondition).
 */
export const isEvidence = (testCase: ITestCase): boolean =>
  testCase.outcome === "failed" &&
  testCase.failureType === "AssertionError" &&
  !(testCase.failureMessage ?? "").includes(INFRA_MARKER);

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/&#10;/g, "\n")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const attribute = (tag: string, name: string): string | undefined =>
  new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];

/**
 * Parses Bun's JUnit report into a flat list of test cases.
 *
 * Deliberately tolerant of nesting: Bun emits a `testsuite` per file and
 * another per `describe`, and only the outer one carries the file path.
 */
export const parseJUnit = (xml: string): ITestCase[] => {
  const cases: ITestCase[] = [];
  const casePattern = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;

  for (const match of xml.matchAll(casePattern)) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    const rawFile = attribute(attrs, "file") ?? "";
    const name = decodeXmlEntities(attribute(attrs, "name") ?? "");
    const file = rawFile.split("/").pop() ?? rawFile;

    if (/<skipped\b/.test(body)) {
      cases.push({ file, name, outcome: "skipped" });
      continue;
    }

    const failure = /<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1>/.exec(body);

    if (failure === null) {
      cases.push({ file, name, outcome: "passed" });
      continue;
    }

    cases.push({
      file,
      name,
      outcome: "failed",
      failureType: attribute(failure[2] ?? "", "type") ?? "Error",
      failureMessage: decodeXmlEntities(failure[3] ?? ""),
    });
  }

  return cases;
};

export interface IReconcileInput {
  readonly manifest: IManifest;
  readonly cases: ITestCase[];
  /** False when the runner produced no usable report at all. */
  readonly runCompleted: boolean;
}

/**
 * Returns a list of human-readable problems. Empty means the manifest and the
 * run agree, every mapped test executed, and every failure is real evidence.
 */
/** Nothing in this suite is conditional, so a skip means it stopped running. */
const checkNoSkips = (cases: ITestCase[]): string[] =>
  cases
    .filter((entry) => entry.outcome === "skipped")
    .map(
      (entry) =>
        `${entry.file}: "${entry.name}" was skipped; this suite has no ` +
        `conditional tests, so a skip means it silently stopped running`
    );

/** Only assertion failures are evidence; anything else is a broken test. */
const checkFailureKinds = (cases: ITestCase[]): string[] =>
  cases
    .filter((entry) => entry.outcome === "failed" && !isEvidence(entry))
    .map((entry) => {
      const firstLine = (entry.failureMessage ?? "").split("\n")[0] ?? "";

      return (
        `${entry.file}: "${entry.name}" failed with ` +
        `${entry.failureType ?? "Error"} rather than an assertion — ` +
        `the test did not reach the behaviour it claims to prove ` +
        `(${firstLine.slice(0, 120)})`
      );
    });

/** A fixture that cannot demonstrate the healthy path proves nothing. */
const checkControlsPass = (cases: ITestCase[]): string[] =>
  cases
    .filter((entry) => isControl(entry) && entry.outcome !== "passed")
    .map(
      (entry) =>
        `${entry.file}: control "${entry.name}" did not pass, so the ` +
        `fixture proves nothing about the finding`
    );

const outcomeOf = (testCase: ITestCase): CaseExpectation | "invalid" => {
  if (testCase.outcome === "passed") {
    return "pass";
  }

  return isEvidence(testCase) ? "assertion-fail" : "invalid";
};

/** Case names are the reconciliation key, so they have to be unique. */
const checkUniqueNames = (finding: IFinding, own: ITestCase[]): string[] => {
  const seen = new Map<string, number>();

  for (const entry of own) {
    seen.set(entry.name, (seen.get(entry.name) ?? 0) + 1);
  }

  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(
      ([name, count]) =>
        `${finding.id}: "${name}" ran ${count} times in ${finding.file}; ` +
        "case names must be unique so expectations can be reconciled"
    );
};

/** Every recorded case must have run, and matched its recorded outcome. */
const checkExpectedCases = (finding: IFinding, own: ITestCase[]): string[] =>
  Object.entries(finding.cases).flatMap(([name, expected]) => {
    const actual = own.find((entry) => entry.name === name);

    if (actual === undefined) {
      return [
        `${finding.id}: expected case "${name}" did not run in ${finding.file}`,
      ];
    }

    const got = outcomeOf(actual);

    if (got === expected) {
      return [];
    }

    return [
      `${finding.id}: "${name}" was expected to ${expected} but did ` +
        (got === "invalid" ? "not fail on an assertion" : got),
    ];
  });

/** And nothing may run that the manifest does not know about. */
const checkUnlistedCases = (finding: IFinding, own: ITestCase[]): string[] =>
  own
    .filter((entry) => !(entry.name in finding.cases))
    .map(
      (entry) =>
        `${finding.id}: "${entry.name}" ran but is not listed in the ` +
        "manifest; add it with its expected outcome"
    );

const checkFinding = (finding: IFinding, cases: ITestCase[]): string[] => {
  const own = cases.filter((entry) => entry.file === finding.file);

  if (own.length === 0) {
    return [`${finding.id}: ${finding.file} executed no tests at all`];
  }

  const problems: string[] = [
    ...checkUniqueNames(finding, own),
    ...checkExpectedCases(finding, own),
    ...checkUnlistedCases(finding, own),
  ];

  const controls = own.filter(isControl);

  /*
   * At least one positive control per finding. Without one there is nothing
   * separating "the defect is present" from "the fixture never worked" —
   * which is how two findings in the first version of this suite were
   * reported as proven while their setup was throwing.
   */
  if (controls.length === 0) {
    problems.push(
      `${finding.id}: ${finding.file} has no positive control, so a ` +
        `failure there cannot be distinguished from a broken fixture`
    );
  }

  const evidence = own.filter(
    (entry) => isEvidence(entry) && !isControl(entry)
  );

  if (finding.status === "proven" && evidence.length === 0) {
    problems.push(
      `${finding.id} is marked "proven" but no test failed on an ` +
        `assertion — either it was fixed (set status to "fixed") or the ` +
        `test stopped exercising the defect`
    );
  }

  const stillFailing = own.filter((entry) => entry.outcome === "failed");

  if (finding.status === "fixed" && stillFailing.length > 0) {
    problems.push(
      `${finding.id} is marked "fixed" but ${stillFailing.length} test(s) ` +
        `still fail`
    );
  }

  return problems;
};

/**
 * Returns a list of human-readable problems. Empty means the manifest and the
 * run agree, every mapped test executed, and every failure is real evidence.
 */
/** Nothing in this suite is conditional, so a skip means it stopped running. */

/**
 * Returns a list of human-readable problems. Empty means the manifest and the
 * run agree, every mapped test executed, and every failure is real evidence.
 */
export const reconcile = ({
  manifest,
  cases,
  runCompleted,
}: IReconcileInput): string[] => {
  if (!runCompleted) {
    return [
      "the spec suite produced no report — treat this as a failure, not as " +
        "an absence of findings. Check that Postgres and Valkey are up and " +
        "that the lane env is set.",
    ];
  }

  return [
    ...checkNoSkips(cases),
    ...checkFailureKinds(cases),
    ...checkControlsPass(cases),
    ...manifest.findings
      .filter((finding) => finding.status !== "refuted")
      .flatMap((finding) => checkFinding(finding, cases)),
  ];
};
