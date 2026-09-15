import {
  MIN_FUNCTION,
  MIN_LINE,
} from "../../apps/api/scripts/quality/coverage-thresholds";

export interface ICoverageSummary {
  /** Mean of per-file line percentages, which is how Bun's "All files" row is computed. */
  linePct: number;
  /** Same mean for functions; across shards a lower bound (see mergeLcov). */
  functionPct: number;
  files: number;
}

interface IFileCoverage {
  lines: Map<number, boolean>;
  functionsTotal: number;
  functionsCovered: number;
}

/**
 * Merges the LCOV reports of test shards into the figure Bun's own text
 * reporter prints: the unweighted mean of per-file percentages (verified
 * against `bun test --coverage` on the same run). Lines are exact: a line
 * counts as covered when any shard hit it, exactly as a single run would.
 * Bun's LCOV carries only per-file function counts (FNF/FNH, no FN/FNDA),
 * so functions can only be combined as the best single shard per file: a
 * lower bound, never an overstatement. Callers that see the bound miss the
 * floor must confirm with a whole-suite run before failing.
 */
export function mergeLcov(reports: readonly string[]): ICoverageSummary {
  const files = new Map<string, IFileCoverage>();

  for (const report of reports) {
    let current: IFileCoverage | undefined;
    let functionsCovered = 0;
    let functionsTotal = 0;

    for (const rawLine of report.split("\n")) {
      const line = rawLine.trim();

      if (line.startsWith("SF:")) {
        const path = line.slice(3);
        const existing = files.get(path) ?? {
          lines: new Map<number, boolean>(),
          functionsTotal: 0,
          functionsCovered: 0,
        };

        files.set(path, existing);
        current = existing;
        functionsCovered = 0;
        functionsTotal = 0;
      } else if (line.startsWith("DA:") && current !== undefined) {
        const [lineNumber, hits] = line.slice(3).split(",");
        const number = Number(lineNumber);
        const hit = Number(hits) > 0;

        if (Number.isSafeInteger(number)) {
          current.lines.set(
            number,
            (current.lines.get(number) ?? false) || hit
          );
        }
      } else if (line.startsWith("FNF:")) {
        functionsTotal = Number(line.slice(4));
      } else if (line.startsWith("FNH:")) {
        functionsCovered = Number(line.slice(4));
      } else if (line === "end_of_record" && current !== undefined) {
        current.functionsTotal = Math.max(
          current.functionsTotal,
          functionsTotal
        );
        current.functionsCovered = Math.max(
          current.functionsCovered,
          functionsCovered
        );
        current = undefined;
      }
    }
  }

  const withLines = [...files.values()].filter((file) => file.lines.size > 0);
  const linePcts = withLines.map(
    (file) => [...file.lines.values()].filter(Boolean).length / file.lines.size
  );
  const functionPcts = withLines.map((file) =>
    file.functionsTotal === 0 ? 1 : file.functionsCovered / file.functionsTotal
  );
  const mean = (values: readonly number[]): number =>
    values.length === 0
      ? 0
      : values.reduce((total, value) => total + value, 0) / values.length;

  return {
    linePct: mean(linePcts),
    functionPct: mean(functionPcts),
    files: withLines.length,
  };
}

export type CoverageVerdict =
  "passed" | "lines_below_floor" | "functions_unconfirmed";

/** Lines decide directly; a function bound under the floor only asks for confirmation. */
export function coverageVerdict(summary: ICoverageSummary): CoverageVerdict {
  if (summary.files === 0 || summary.linePct < MIN_LINE) {
    return "lines_below_floor";
  }

  return summary.functionPct < MIN_FUNCTION
    ? "functions_unconfirmed"
    : "passed";
}

export function formatCoverage(summary: ICoverageSummary): string {
  const pct = (value: number): string => `${(value * 100).toFixed(2)}%`;

  return `lines ${pct(summary.linePct)}, functions >= ${pct(summary.functionPct)} across ${String(summary.files)} files (mean of per-file rates, as Bun reports)`;
}
