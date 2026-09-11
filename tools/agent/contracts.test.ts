import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RELEASE_CHECKS, STATIC_CHECKS } from "./checks";
import { runProcess } from "./process";
import { testEvidence } from "./reports";
import { inspectTask } from "./tasks";
import { isRecord, parseRecord } from "./validation";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("every check adapter references an existing package script", () => {
  for (const check of [...STATIC_CHECKS, ...RELEASE_CHECKS]) {
    const scripts = parseRecord(
      readFileSync(
        check.app === "root"
          ? join(root, "package.json")
          : join(root, "apps", check.app, "package.json"),
        "utf8"
      )
    ).scripts;

    if (!isRecord(scripts)) {
      throw new Error("Package scripts missing");
    }

    expect(typeof scripts[check.script]).toBe("string");
  }
});
test("task recipe paths and commands stay valid", () => {
  expect(inspectTask(root, "account-resource")).toHaveProperty(
    "schemaVersion",
    1
  );
  expect(() => inspectTask(root, "unknown")).toThrow();
});
test("test reports cannot count skipped or missing cases as success", () => {
  expect(testEvidence("test", "", 0).status).toBe("blocked");
  expect(
    testEvidence(
      "test",
      '<testsuites><testcase name="x"><skipped/></testcase></testsuites>',
      0
    ).status
  ).toBe("blocked");
  expect(
    testEvidence("test", '<testsuites><testcase name="x"/></testsuites>', 0)
      .status
  ).toBe("passed");
  expect(
    testEvidence("test", '<testsuites><testcase name="x"/></testsuites>', 1)
      .status
  ).toBe("blocked");
  expect(
    testEvidence(
      "test",
      '<testsuites><testcase name="x"><failure type="AssertionError">assertion</failure></testcase></testsuites>',
      1
    ).status
  ).toBe("failed");
});
test("process execution is bounded and doesn't evaluate shell syntax", async () => {
  const result = await runProcess(
    [
      process.execPath,
      "-e",
      "console.log(process.argv[1])",
      "$(never-execute)",
    ],
    { cwd: root }
  );

  expect(result.stdout.trim()).toBe("$(never-execute)");
  const stall = await runProcess(
    [process.execPath, "-e", "setInterval(()=>{},1000)"],
    { cwd: root, timeoutMs: 50 }
  );

  expect(stall.status).toBe("blocked");
});

test("release browser builds use production rather than test mode", () => {
  expect(RELEASE_CHECKS.find((check) => check.id === "ui.build")?.nodeEnv).toBe(
    "production"
  );
  expect(
    RELEASE_CHECKS.find((check) => check.id === "docs.build")?.nodeEnv
  ).toBe("production");
});
