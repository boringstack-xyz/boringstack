import { describe, expect, test } from "bun:test";

import type { ILogRecord } from "./logs.utils";
import {
  compileRules,
  EMPTY_LEDGER,
  findingIdOf,
  mergeLedger,
  parseExpectedFile,
  parseLedger,
  scanFindings,
  unfiledFindings,
} from "./findings.utils";

const error = (overrides: Partial<ILogRecord>): ILogRecord => ({
  time: "2026-11-23T10:00:00Z",
  service: "api",
  level: "error",
  message: "boom 1",
  event: null,
  requestId: null,
  ...overrides,
});

describe("expected findings file", () => {
  test("reads its rules, and a rule needs a reason", () => {
    expect(
      parseExpectedFile({
        version: 1,
        description: "x",
        rules: [{ service: "api", match: "^expected", reason: "on purpose" }],
      })
    ).toEqual([{ service: "api", match: "^expected", reason: "on purpose" }]);
    expect(() =>
      parseExpectedFile({
        version: 1,
        rules: [{ service: "api", match: "x", reason: " " }],
      })
    ).toThrow("rule 0");
    expect(() => parseExpectedFile({ version: 2, rules: [] })).toThrow(
      "version"
    );
  });

  test("a rule with a bad pattern names itself", () => {
    expect(() =>
      compileRules([{ service: "api", match: "(", reason: "r" }])
    ).toThrow("rule 0 (api)");
  });
});

describe("scanning and muting", () => {
  test("only errors become findings, one per service, event and shape", () => {
    const found = scanFindings(
      [
        error({ message: "boom 1" }),
        error({ message: "boom 2", time: "2026-11-23T10:05:00Z" }),
        error({ level: "warn", message: "a warning" }),
      ],
      []
    );

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      signature: "boom <n>",
      count: 2,
      firstSeen: "2026-11-23T10:00:00Z",
      lastSeen: "2026-11-23T10:05:00Z",
      muted: false,
      filed: null,
    });
    expect(found[0]?.id).toBe(findingIdOf("api", "boom <n>", null));
  });

  test("a rule mutes matching messages of the service it names", () => {
    const rules = compileRules([
      { service: "ap*", match: "expected", reason: "on purpose" },
    ]);
    const found = scanFindings(
      [
        error({ message: "expected thing" }),
        error({ service: "web", message: "expected thing" }),
      ],
      rules
    );

    expect(found.map((finding) => [finding.service, finding.muted])).toEqual([
      ["api", true],
      ["web", false],
    ]);
  });
});

describe("ledger", () => {
  test("merging keeps filed issues and updates counts", () => {
    const first = scanFindings([error({ message: "boom 1" })], []);
    const filed = mergeLedger(EMPTY_LEDGER, first).findings.map((finding) => ({
      ...finding,
      filed: { url: "https://github.com/o/r/issues/7" },
    }));
    const later = scanFindings(
      [error({ message: "boom 9", time: "2026-11-23T11:00:00Z" })],
      []
    );
    const merged = mergeLedger({ version: 1, findings: filed }, later);

    expect(merged.findings).toHaveLength(1);
    expect(merged.findings[0]).toMatchObject({
      count: 1,
      lastSeen: "2026-11-23T11:00:00Z",
      firstSeen: "2026-11-23T10:00:00Z",
      filed: { url: "https://github.com/o/r/issues/7" },
    });
    expect(unfiledFindings(merged)).toEqual([]);
  });

  test("unfiled findings skip muted ones and the most frequent come first", () => {
    const rules = compileRules([
      { service: "api", match: "^quiet", reason: "r" },
    ]);
    const scanned = scanFindings(
      [
        error({ message: "rare" }),
        error({ message: "common 1" }),
        error({ message: "common 2" }),
        error({ message: "quiet 1" }),
      ],
      rules
    );
    const unfiled = unfiledFindings(mergeLedger(EMPTY_LEDGER, scanned));

    expect(unfiled.map((finding) => finding.signature)).toEqual([
      "common <n>",
      "rare",
    ]);
  });

  test("a ledger that does not read is empty, not a crash", () => {
    expect(parseLedger("garbage")).toEqual(EMPTY_LEDGER);
    expect(parseLedger({ findings: [{ id: 1 }] }).findings).toEqual([]);
  });
});
