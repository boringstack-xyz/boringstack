import { copyFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  appendFeature,
  appendToTuple,
} from "../../scripts/codegen/acl-scaffold/edit-tuple";

const CONSTANTS_PATH = resolve(
  process.cwd(),
  "src",
  "lib",
  "acl",
  "acl.constants.ts"
);
const SNAPSHOT_PATH = `${CONSTANTS_PATH}.test-snapshot`;

describe("acl-scaffold/edit-tuple", () => {
  beforeEach(() => {
    copyFileSync(CONSTANTS_PATH, SNAPSHOT_PATH);
  });

  afterEach(() => {
    if (!existsSync(SNAPSHOT_PATH)) {
      return;
    }

    copyFileSync(SNAPSHOT_PATH, CONSTANTS_PATH);
    unlinkSync(SNAPSHOT_PATH);
  });

  test("appendToTuple adds a new value before the 'all' sentinel", () => {
    const changed = appendToTuple("SUBJECTS", "Webhook");

    expect(changed).toBe(true);

    const after = readFileSync(CONSTANTS_PATH, "utf8");
    const subjectsBlock = /export const SUBJECTS = \[(?<body>[\S\s]*?)]/.exec(
      after
    );

    expect(subjectsBlock?.groups?.body ?? "").toContain('"Webhook"');
    expect(subjectsBlock?.groups?.body ?? "").toMatch(/"Webhook",\s+"all",/);
  });

  test("appendToTuple appends to a tuple without an 'all' sentinel", () => {
    appendToTuple("ACTIONS", "archive");

    const after = readFileSync(CONSTANTS_PATH, "utf8");

    expect(after).toContain('"archive"');
    expect(after).toMatch(/"invite",\s+"archive",/);
  });

  test("appendToTuple is idempotent (returns false on a duplicate)", () => {
    expect(appendToTuple("ROLES", "owner")).toBe(false);
  });

  test("appendFeature inserts a new entry into FEATURES with the chosen kind+default", () => {
    const changed = appendFeature("can_share", "boolean", false);

    expect(changed).toBe(true);

    const after = readFileSync(CONSTANTS_PATH, "utf8");

    expect(after).toContain('can_share: { kind: "boolean", default: false },');
  });

  test("appendFeature is idempotent on the FEATURES key", () => {
    expect(appendFeature("max_seats", "limit", 1)).toBe(false);
  });

  test("rewrites a single-line tuple into multi-line form when first appending", () => {
    appendToTuple("ROLES", "billing_admin");

    const after = readFileSync(CONSTANTS_PATH, "utf8");
    const rolesBlock = /export const ROLES = \[(?<body>[\S\s]*?)]/.exec(after);

    expect(rolesBlock?.groups?.body).toContain("ROLE.billing_admin");
    // Body should be multi-line after the rewrite.
    expect(rolesBlock?.groups?.body?.split("\n").length).toBeGreaterThan(1);
  });
});
