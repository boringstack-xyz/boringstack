import { afterEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { identifyCheckout } from "./checkout";
import {
  INVENTORY_REASONS,
  inventoryEvidence,
  readInventory,
  reviewInventories,
  settleInventories,
} from "./inventory";
import type { ICheckResult } from "./result";

const dirs: string[] = [];
const passed: ICheckResult = {
  checkId: "api.tests",
  status: "passed",
  reason: "tests_passed",
};

function fixture(cases: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "bs-inventory-evidence-"));

  dirs.push(dir);
  execFileSync("git", ["init", "-q", dir]);
  writeFileSync(join(dir, ".gitignore"), ".agent-state/\n");
  writeFileSync(join(dir, "README.md"), "fixture\n");
  execFileSync("git", ["-C", dir, "add", "."]);
  execFileSync("git", [
    "-C",
    dir,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "fixture",
  ]);
  mkdirSync(join(dir, "tools/agent/inventories"), { recursive: true });
  writeFileSync(
    join(dir, "tools/agent/inventories/api.tests.json"),
    `${JSON.stringify({ schemaVersion: 1, cases }, null, 2)}\n`
  );

  return dir;
}

function xmlFor(names: string[]): string {
  const cases = names
    .map((name) => `<testcase file="a.ts" name="${name}"/>`)
    .join("");

  return `<testsuites>${cases}</testsuites>`;
}

function baseline(dir: string): string[] {
  return readInventory(join(dir, "tools/agent/inventories/api.tests.json"))
    .cases;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const control = JSON.stringify(["a.ts", "control"]);
const added = JSON.stringify(["a.ts", "new case"]);

test("additions pass and are written to the baseline by the same run", () => {
  const dir = fixture([control]);
  const fingerprint = identifyCheckout(dir).fingerprint;
  const evidence = inventoryEvidence(
    dir,
    "api.tests",
    xmlFor(["control", "new case"]),
    passed,
    fingerprint
  );

  expect(evidence.status).toBe("passed");
  expect(evidence.reason).toBe(INVENTORY_REASONS.additions);

  const settled = settleInventories(dir, [evidence], fingerprint);

  expect(settled[0]?.status).toBe("passed");
  expect(baseline(dir)).toEqual([added, control].sort());

  const rerunFingerprint = identifyCheckout(dir).fingerprint;
  const rerun = inventoryEvidence(
    dir,
    "api.tests",
    xmlFor(["control", "new case"]),
    passed,
    rerunFingerprint
  );

  expect(rerun).toEqual(passed);
});

test("removals stay blocked, are never written, and print one acknowledgement command", () => {
  const dir = fixture([control, added]);
  const fingerprint = identifyCheckout(dir).fingerprint;
  const before = readFileSync(
    join(dir, "tools/agent/inventories/api.tests.json"),
    "utf8"
  );
  const evidence = inventoryEvidence(
    dir,
    "api.tests",
    xmlFor(["control"]),
    passed,
    fingerprint
  );

  expect(evidence.status).toBe("blocked");
  expect(evidence.reason).toBe(INVENTORY_REASONS.disagrees);

  const [settled] = settleInventories(dir, [evidence], fingerprint);
  const token = reviewInventories(dir, ["api.tests"]).token;
  const command = `bun run agent:inventory -- api.tests --accept=${token} --allow-removals=${token}`;

  expect(settled?.status).toBe("blocked");
  expect(settled?.remediation).toContain(command);
  expect(settled?.remediation).toContain("new case");
  expect(
    readFileSync(join(dir, "tools/agent/inventories/api.tests.json"), "utf8")
  ).toBe(before);
});

test("zero observed cases stay blocked and are never recorded", () => {
  const dir = fixture([control]);
  const fingerprint = identifyCheckout(dir).fingerprint;
  const evidence = inventoryEvidence(
    dir,
    "api.tests",
    "<testsuites></testsuites>",
    passed,
    fingerprint
  );

  expect(evidence.status).toBe("blocked");
  expect(evidence.reason).toBe(INVENTORY_REASONS.empty);
  expect(settleInventories(dir, [evidence], fingerprint)[0]?.remediation).toBe(
    undefined
  );
  expect(baseline(dir)).toEqual([control]);
});

test("additions in one lane are not written while another lane has removals", () => {
  const dir = fixture([control]);
  const fingerprint = identifyCheckout(dir).fingerprint;
  const additions = inventoryEvidence(
    dir,
    "api.tests",
    xmlFor(["control", "new case"]),
    passed,
    fingerprint
  );
  const uiRemoval: ICheckResult = {
    checkId: "ui.tests",
    status: "blocked",
    reason: INVENTORY_REASONS.disagrees,
  };
  const settled = settleInventories(dir, [additions, uiRemoval], fingerprint);

  expect(settled.find((check) => check.checkId === "api.tests")?.status).toBe(
    "passed"
  );
  expect(baseline(dir)).toEqual([control]);
});

test("additions are not recorded when the observation is not bound to this checkout", () => {
  const dir = fixture([control]);
  const evidence = inventoryEvidence(
    dir,
    "api.tests",
    xmlFor(["control", "new case"]),
    passed,
    "not-this-checkout"
  );

  expect(evidence.status).toBe("blocked");
  expect(evidence.reason).toBe(INVENTORY_REASONS.disagrees);
  expect(baseline(dir)).toEqual([control]);
});

test("committed baselines are valid, non-empty inventories", () => {
  for (const lane of ["api.tests", "ui.tests", "ui.e2e"]) {
    const inventory = readInventory(
      join(import.meta.dir, "inventories", `${lane}.json`)
    );

    expect(inventory.cases.length).toBeGreaterThan(0);
  }
});
