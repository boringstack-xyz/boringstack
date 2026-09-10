/**
 * Tests for the security-spec finding scaffold.
 *
 * The first version interpolated the title straight into double-quoted
 * TypeScript, so `rejects "none" as a signing algorithm`, an entirely
 * ordinary finding title, closed the string literal and produced a file that
 * did not parse. The generator reported success and had already written the
 * manifest row, leaving a manifest that pointed at a broken file.
 *
 * Every case below is a title that has to survive three different escaping
 * contexts at once: a TypeScript string literal, a block comment, and a JSON
 * key.
 */
import { describe, expect, test } from "bun:test";

import {
  CONTROL_CASE,
  type IArgs,
  buildManifest,
  buildSpecFile,
  parseArgs,
  parseError,
  specFileName,
} from "../../scripts/codegen/new-finding-lib";

const EMPTY_MANIFEST = '{"reviewedCommit":"probe","findings":[]}';
const FILE = "f19-example.test.ts";

/*
 * `Array.isArray` widens `unknown` to `any[]`, which then infects every
 * element access. Narrow to `unknown[]` instead: the same guard the manifest
 * checker uses, for the same reason.
 */
const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("expected an object");
  }

  return { ...value };
};

/** The single finding a freshly built manifest contains. */
const onlyFinding = (manifestText: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(manifestText);
  const findings = asRecord(parsed).findings;

  if (!isUnknownArray(findings) || findings.length !== 1) {
    throw new TypeError("expected exactly one finding");
  }

  return asRecord(findings[0]);
};

const argsFor = (title: string): IArgs => {
  const parsed = parseArgs(["F19", "high", title]);

  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  return parsed.args;
};

const HOSTILE_TITLES: readonly [string, string][] = [
  ["double quotes", 'rejects "none" as a signing algorithm'],
  ["backslashes", String.raw`path C:\temp\x is trusted`],
  ["a comment terminator", "closes the comment */ here"],
  ["a template placeholder", "token ${process.exit(1)} leaks"],
  ["a backtick", "backtick ` and ${x} in one"],
  ["a newline", "multi\nline title"],
  ["a lone trailing backslash", "trailing backslash \\"],
];

describe("new-finding scaffold", () => {
  describe.each(HOSTILE_TITLES)("a title with %s", (_label, title) => {
    test("generates a file that parses", () => {
      const generated = buildSpecFile(argsFor(title));

      expect(parseError(generated, FILE)).toBeUndefined();
    });

    test("records the same case name in the file and the manifest", () => {
      const args = argsFor(title);
      const finding = onlyFinding(buildManifest(EMPTY_MANIFEST, args, FILE));
      const cases = asRecord(finding.cases);

      /*
       * The reconciler matches cases by exact name, so a title that survives
       * into the file but is mangled in the manifest reports as one missing
       * case plus one unlisted case on every run.
       */
      expect(Object.keys(cases)).toContain(args.title);
      expect(buildSpecFile(args)).toContain(JSON.stringify(args.title));
    });
  });

  test("collapses whitespace so a multiline title cannot break the comment", () => {
    expect(argsFor("multi\n  line\ttitle").title).toBe("multi line title");
  });

  test("escapes a comment terminator in the file header", () => {
    const generated = buildSpecFile(argsFor("closes the comment */ here"));
    const header = generated.slice(0, generated.indexOf("*/\n"));

    expect(header).toContain("*\\/");
  });

  test("a template placeholder stays inert rather than interpolating", () => {
    const generated = buildSpecFile(argsFor("token ${1 + 1} leaks"));

    expect(generated).toContain('"F19 token ${1 + 1} leaks"');
    expect(generated).not.toContain("token 2 leaks");
  });

  /* ------------------------------------------------------- argument parsing */

  test("rejects a malformed finding id", () => {
    const parsed = parseArgs(["F9", "high", "something"]);

    expect(parsed.ok).toBe(false);
  });

  test("rejects an unknown severity", () => {
    const parsed = parseArgs(["F19", "spicy", "something"]);

    expect(parsed.ok).toBe(false);
  });

  test("rejects an empty title", () => {
    expect(parseArgs(["F19", "high", "   "]).ok).toBe(false);
  });

  test("tolerates the bun `--` separator", () => {
    const parsed = parseArgs(["--", "F19", "high", "a", "title"]);

    expect(parsed.ok && parsed.args.title).toBe("a title");
  });

  /* -------------------------------------------------------------- manifest */

  test("refuses to add a finding id that is already listed", () => {
    const args = argsFor("something");
    const once = buildManifest(EMPTY_MANIFEST, args, FILE);

    expect(() => buildManifest(once, args, FILE)).toThrow("already in");
  });

  test("pairs every scaffolded finding with a passing control", () => {
    const finding = onlyFinding(
      buildManifest(EMPTY_MANIFEST, argsFor("something"), FILE)
    );

    expect(asRecord(finding.cases)[CONTROL_CASE]).toBe("pass");
  });

  test("derives a filename slug that is safe on disk", () => {
    expect(specFileName(argsFor('rejects "none" as a signing algorithm'))).toBe(
      "f19-rejects-none-as-a-signing-algorithm.test.ts"
    );
  });
});
