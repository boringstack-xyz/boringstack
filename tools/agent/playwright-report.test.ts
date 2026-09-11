import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProcess } from "./process";
import { testEvidence } from "./reports";
import { requireValue } from "./validation";

const root = join(import.meta.dir, "../..");

test("real Playwright assertions fail while fixture exceptions block", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bs-playwright-report-"));

  try {
    const report = join(dir, "report.xml");

    writeFileSync(
      join(dir, "probe.spec.ts"),
      `import {test,expect} from ${JSON.stringify(join(root, "apps/ui/node_modules/@playwright/test/index.js"))};\ntest('assertion',()=>{expect(1).toBe(2);});\ntest('infrastructure',()=>{throw new Error('SPEC-INFRA: database unavailable');});\ntest('control',()=>{expect(1).toBe(1);});`
    );
    writeFileSync(
      join(dir, "playwright.config.ts"),
      `export default {testDir:${JSON.stringify(dir)},outputDir:${JSON.stringify(join(dir, "results"))},reporter:[['junit',{outputFile:${JSON.stringify(report)}}]],workers:1,retries:0};`
    );
    const run = await runProcess(
      [
        process.execPath,
        "node_modules/@playwright/test/cli.js",
        "test",
        "--config=" + join(dir, "playwright.config.ts"),
      ],
      { cwd: join(root, "apps/ui"), timeoutMs: 30000 }
    );

    expect(run.code).toBe(1);
    const xml = readFileSync(report, "utf8");
    const cases = [...xml.matchAll(/<testcase\b[\s\S]*?<\/testcase>/g)].map(
      (match) => match[0]
    );

    expect(cases).toHaveLength(3);
    expect(
      testEvidence(
        "browser",
        `<testsuites>${requireValue(cases[0], "Expected reported test case")}</testsuites>`,
        1,
        "playwright"
      ).status
    ).toBe("failed");
    expect(
      testEvidence(
        "browser",
        `<testsuites>${requireValue(cases[1], "Expected reported test case")}</testsuites>`,
        1,
        "playwright"
      ).status
    ).toBe("blocked");
    expect(
      testEvidence(
        "browser",
        `<testsuites>${requireValue(cases[2], "Expected reported test case")}</testsuites>`,
        0,
        "playwright"
      ).status
    ).toBe("passed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 35000);
