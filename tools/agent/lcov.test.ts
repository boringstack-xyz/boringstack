import { expect, test } from "bun:test";
import { coverageVerdict, formatCoverage, mergeLcov } from "./lcov";

const record = (
  file: string,
  lines: [number, number][],
  fnf: number,
  fnh: number
): string =>
  [
    "TN:",
    `SF:${file}`,
    `FNF:${String(fnf)}`,
    `FNH:${String(fnh)}`,
    ...lines.map(([line, hits]) => `DA:${String(line)},${String(hits)}`),
    `LF:${String(lines.length)}`,
    `LH:${String(lines.filter(([, hits]) => hits > 0).length)}`,
    "end_of_record",
  ].join("\n");

test("lines merge as a union across shards, functions as the best shard per file", () => {
  const shardA = record(
    "src/a.ts",
    [
      [1, 1],
      [2, 0],
      [3, 0],
    ],
    4,
    2
  );
  const shardB =
    record(
      "src/a.ts",
      [
        [1, 0],
        [2, 1],
        [3, 0],
      ],
      4,
      3
    ) +
    "\n" +
    record("src/b.ts", [[1, 1]], 1, 1);
  const summary = mergeLcov([shardA, shardB]);

  // a.ts: 2 of 3 lines after the union, best shard 3 of 4 functions; b.ts: 1/1 and 1/1.
  expect(summary.files).toBe(2);
  expect(summary.linePct).toBeCloseTo((2 / 3 + 1) / 2, 6);
  expect(summary.functionPct).toBeCloseTo((3 / 4 + 1) / 2, 6);
  expect(formatCoverage(summary)).toContain("lines 83.33%");
});

test("the verdict fails on lines, only asks for confirmation on the function bound", () => {
  const fine = { linePct: 0.9, functionPct: 0.9, files: 1 };
  const lowLines = { linePct: 0.1, functionPct: 0.9, files: 1 };
  const lowFunctionBound = { linePct: 0.9, functionPct: 0.2, files: 1 };

  expect(coverageVerdict(fine)).toBe("passed");
  expect(coverageVerdict(lowLines)).toBe("lines_below_floor");
  expect(coverageVerdict(lowFunctionBound)).toBe("functions_unconfirmed");
  expect(coverageVerdict(mergeLcov([]))).toBe("lines_below_floor");
});

test("a file without functions counts as fully covered for functions, as Bun does", () => {
  const summary = mergeLcov([record("src/constants.ts", [[1, 1]], 0, 0)]);

  expect(summary.functionPct).toBe(1);
});
