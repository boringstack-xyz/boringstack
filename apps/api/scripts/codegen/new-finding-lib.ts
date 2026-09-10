/**
 * Pure helpers for `new-finding.ts`.
 *
 * Split out for the same reason `security-manifest-lib.ts` is: the script
 * itself is a top-level-await runner that touches the real
 * `security-spec/findings.json`, so nothing in it can be unit tested without
 * scaffolding into the live suite.
 */
import ts from "typescript";

export const SEVERITIES: readonly string[] = [
  "critical",
  "high",
  "medium",
  "low",
];

export const CONTROL_CASE =
  "control: the same operation succeeds when it should";

export const USAGE =
  'Usage: bun run new:finding -- <id> <severity> "<title>"\n' +
  'Example: bun run new:finding -- F19 high "invitation tokens are not rotated"\n' +
  `Severity is one of: ${SEVERITIES.join(", ")}`;

export interface IArgs {
  readonly id: string;
  readonly severity: string;
  readonly title: string;
}

export type ParseResult =
  | { readonly ok: true; readonly args: IArgs }
  | { readonly ok: false; readonly error: string };

const isSeverity = (value: string): boolean => SEVERITIES.includes(value);

/*
 * Titles are free text from a shell argument and land in three places with
 * three different escaping rules: a TypeScript string literal, a block
 * comment, and a JSON key. A title as ordinary as
 * `rejects "none" as a signing algorithm` closes an unescaped string
 * literal and produces a file that does not parse.
 *
 * Whitespace is collapsed first, so a multiline argument cannot break the
 * comment or leave a newline inside a manifest key.
 */
export const normaliseTitle = (title: string): string =>
  title.replace(/\s+/gu, " ").trim();

/** A TypeScript/JSON string literal, correctly escaped. */
export const literal = (value: string): string => JSON.stringify(value);

/** Safe inside a block comment: an unescaped terminator would close it. */
export const commentSafe = (value: string): string =>
  value.replace(/\*\//gu, "*\\/");

export const toSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^\da-z]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .split("-")
    .slice(0, 6)
    .join("-");

export const parseArgs = (argv: readonly string[]): ParseResult => {
  const rest = argv.filter((value) => value !== "--");
  const [id, severity, ...titleParts] = rest;
  const title = normaliseTitle(titleParts.join(" "));

  if (id === undefined || severity === undefined || title === "") {
    return { ok: false, error: USAGE };
  }

  if (!/^F\d{2}[a-z]?$/u.test(id)) {
    return {
      ok: false,
      error: `Invalid finding id "${id}". Use F + two digits, optionally suffixed: F19, F19a.`,
    };
  }

  if (!isSeverity(severity)) {
    return { ok: false, error: `Invalid severity "${severity}".\n${USAGE}` };
  }

  return { ok: true, args: { id, severity, title } };
};

export const specFileName = (args: IArgs): string =>
  `${args.id.toLowerCase()}-${toSlug(args.title)}.test.ts`;

export const buildSpecFile = (args: IArgs): string => `/**
 * ${args.id} — ${commentSafe(args.title)}.
 *
 * Replace this block with the evidence: the file and line the defect lives
 * on, quoted, and what makes it reachable. A reader has to be able to check
 * the claim without running anything.
 *
 * Then state what the test asserts and why that specific value. "Throws" is
 * not an assertion — name the wrong value the code produces today.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { cleanDatabase } from "../tests/helpers/db";
import { requireDbOrFail, specPrecondition } from "./harness";

beforeEach(async () => {
  await requireDbOrFail();
  await cleanDatabase();
});

describe(${literal(`${args.id} ${args.title}`)}, () => {
  test(${literal(args.title)}, () => {
    /*
     * Deliberately an infrastructure failure, not an assertion failure.
     *
     * An unwritten scaffold that failed on \`expect\` would reconcile as a
     * proven finding and be counted as evidence. \`specPrecondition\` marks it
     * SPEC-INFRA instead, so \`bun run check:security-manifest\` reports the
     * finding as unwritten until someone writes it. Delete this line when the
     * fixture is real.
     */
    specPrecondition(false, ${literal(`${args.id}: fixture not written yet`)});

    /*
     * Assert the INTENDED behaviour, so this fails today and passes
     * unmodified once the finding is fixed. Do not assert the current
     * behaviour and invert it later — the whole value of this suite is that
     * the same test proves the fix. Name the specific wrong value; "throws"
     * is not an assertion.
     */
    expect(true).toBe(false);
  });

  test(${literal(CONTROL_CASE)}, () => {
    /*
     * The positive control. It exercises the same fixture down the allowed
     * path and must pass, so a failure above means the defect rather than a
     * broken seed, a missing cookie or a route that was never reached.
     *
     * Required: \`security-spec-requires-control\` rejects a describe block
     * without one, and the manifest reconciler rejects a finding whose
     * control fails.
     */
    expect(true).toBe(true);
  });
});
`;

/**
 * The first syntax error in `content`, or undefined when it parses.
 *
 * Cheap, and it turns the whole class of escaping bugs into a refusal at
 * generation time rather than a broken file someone finds later.
 */
export const parseError = (
  content: string,
  fileName: string
): string | undefined => {
  const { diagnostics } = ts.transpileModule(content, {
    reportDiagnostics: true,
    fileName,
    compilerOptions: { target: ts.ScriptTarget.Latest },
  });

  const [first] = diagnostics ?? [];

  if (first === undefined) {
    return undefined;
  }

  return ts.flattenDiagnosticMessageText(first.messageText, " ");
};

/*
 * `Array.isArray` narrows `unknown` to `any[]`, which then infects every
 * element. Narrow to `unknown[]` instead: the same guard the manifest
 * checker uses, for the same reason.
 */
const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

/** The manifest text with the new row appended. Throws on a duplicate id. */
export const buildManifest = (
  raw: string,
  args: IArgs,
  file: string
): string => {
  const parsed: unknown = JSON.parse(raw);

  if (typeof parsed !== "object" || parsed === null) {
    throw new TypeError("findings.json is not an object");
  }

  const manifest: Record<string, unknown> = { ...parsed };
  const findings: unknown = manifest.findings;

  if (!isUnknownArray(findings)) {
    throw new TypeError("findings.json has no `findings` array");
  }

  for (const row of findings) {
    if (typeof row === "object" && row !== null && "id" in row) {
      const existing: Record<string, unknown> = { ...row };

      if (existing.id === args.id) {
        throw new Error(`${args.id} is already in findings.json`);
      }
    }
  }

  manifest.findings = [
    ...findings,
    {
      id: args.id,
      severity: args.severity,
      status: "proven",
      file,
      title: args.title,
      cases: {
        [args.title]: "assertion-fail",
        [CONTROL_CASE]: "pass",
      },
    },
  ];

  return `${JSON.stringify(manifest, null, 2)}\n`;
};
