import { describe, expect, test } from "bun:test";

import {
  CLEANUP_TARGETS,
  REFERENCE_TABLES,
  schemaTableNames,
} from "../../../helpers/db";

/*
 * Every table the Drizzle schema defines must be wiped between tests or
 * declared as reference data. A new user-data table that is missing from
 * CLEANUP_TARGETS would otherwise leak rows into later tests.
 */
const cleanupSet = new Set<string>(CLEANUP_TARGETS);
const referenceSet = new Set<string>(REFERENCE_TABLES);

describe("test database cleanup coverage", () => {
  const schemaTables = schemaTableNames();

  test("the Drizzle schema exposes tables to derive from", () => {
    expect(schemaTables.length).toBeGreaterThan(0);
  });

  test("every schema table is cleared between tests or listed as reference data", () => {
    const unlisted = schemaTables.filter(
      (table) => !cleanupSet.has(table) && !referenceSet.has(table)
    );

    expect(unlisted).toEqual([]);
  });

  test("no table is both cleared and treated as reference data", () => {
    const overlap = CLEANUP_TARGETS.filter((table) => referenceSet.has(table));

    expect(overlap).toEqual([]);
  });

  test("every cleanup and reference entry names a table that exists in the schema", () => {
    const schemaSet = new Set(schemaTables);
    const stale = [...CLEANUP_TARGETS, ...REFERENCE_TABLES].filter(
      (table) => !schemaSet.has(table)
    );

    expect(stale).toEqual([]);
  });
});
