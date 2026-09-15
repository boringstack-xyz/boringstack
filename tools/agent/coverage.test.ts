import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runProcess } from "./process";
import { testEvidence } from "./reports";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

test("one coverage execution provides JUnit evidence without weakening quality gates", async () => {
  const directory = mkdtempSync(join(tmpdir(), "bs-coverage-gate-"));
  const scenarios = [
    { output: "All files | 80.00 | 75.00 |", code: 0, expected: "passed" },
    { output: "All files | 60.00 | 75.00 |", code: 0, expected: "failed" },
    {
      output: "All files | 80.00 | 75.00 |\nwarn: forbidden",
      code: 0,
      expected: "failed",
    },
    { output: "No coverage table", code: 0, expected: "blocked" },
    { output: "All files | Infinity | 75.00 |", code: 0, expected: "blocked" },
    { output: "All files | 80.00 | 75.00 |", code: 1, expected: "blocked" },
  ] as const;

  try {
    for (const scenario of scenarios) {
      const report = join(directory, "tests.xml");
      const calls = join(directory, "calls.json");
      const fakeBun = `#!${process.execPath}
import { appendFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + "\\n");
const report = args.find(arg => arg.startsWith("--reporter-outfile="));
if (!report) throw new Error("JUnit report argument was not forwarded");
writeFileSync(report.slice("--reporter-outfile=".length), '<testsuites><testcase name="fixture"/></testsuites>');
console.log(${JSON.stringify(scenario.output)});
process.exit(${String(scenario.code)});
`;

      rmSync(calls, { force: true });
      rmSync(report, { force: true });
      writeFileSync(join(directory, "bun"), fakeBun, { mode: 0o700 });
      const result = await runProcess(
        [
          process.execPath,
          "--no-env-file",
          "scripts/quality/check-coverage.ts",
          "--reporter=junit",
          `--reporter-outfile=${report}`,
        ],
        {
          cwd: join(ROOT, "apps/api"),
          env: { PATH: directory, AGENT_SANDBOX: "1" },
          timeoutMs: 10_000,
        }
      );

      expect(result.status).toBe("completed");
      const evidence = testEvidence(
        "api.tests",
        readFileSync(report, "utf8"),
        result.code,
        "bun",
        result.code === 86
      );

      expect(evidence.status).toBe(scenario.expected);
      expect(readFileSync(calls, "utf8")).toBe(
        JSON.stringify([
          "--no-env-file",
          "test",
          "tests",
          "--coverage",
          "--reporter=junit",
          `--reporter-outfile=${report}`,
        ]) + "\n"
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 90_000);
