import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withoutRecordAccountPredicate } from "../agent-evals/mutants";
import { identifyCheckout } from "./checkout";
import { planAccountResource } from "./generate/account-resource";
import { formatEdits } from "./generate/format";
import {
  acceptInventories,
  compareInventory,
  identities,
  inventoryEvidence,
} from "./inventory";
import { runProcess } from "./process";
import { testEvidence } from "./reports";
import { selectImage } from "./sandbox/lifecycle";
import { requireValue } from "./validation";
import { acquireWorkspace, recoverWorkspace } from "./workspace-lock";

const root = join(import.meta.dir, "../..");

test("retry evidence cannot certify a clean browser run", () => {
  const xml =
    '<testsuites><testcase name="retry"><system-out><![CDATA[[[ATTACHMENT|retry/error-context.md]]]]></system-out></testcase></testsuites>';

  expect(testEvidence("ui.e2e", xml, 0, "playwright").status).toBe("blocked");

  for (const file of [
    "tools/agent/runtime.ts",
    "tools/agent-evals/ui-evaluation.ts",
  ]) {
    expect(readFileSync(join(root, file), "utf8")).toContain('"--retries=0"');
  }
});
test("case identity checks reject a shrunk or same-count substituted suite", () => {
  const expected: [string, string] = [
    '["a.ts","control"]',
    '["a.ts","invariant"]',
  ];

  expect(compareInventory(expected, expected)).toBe(true);
  expect(compareInventory(expected, [expected[0]])).toBe(false);
  expect(
    compareInventory(expected, [expected[0], '["a.ts","replacement"]'])
  ).toBe(false);
  expect(compareInventory([...expected, expected[0]], expected)).toBe(false);
  expect(
    identities(
      '<testsuites><testcase file="/root/a.ts" name="control"/></testsuites>',
      "/root"
    )
  ).toEqual([expected[0]]);
});
test("failure text is not an XML error element and complete product gates remain failures", () => {
  const xml =
    '<testsuites><testcase name="x"><failure type="AssertionError"><![CDATA[expected <error>]]></failure></testcase></testsuites>';

  expect(testEvidence("test", xml, 1).status).toBe("failed");
  expect(
    testEvidence(
      "coverage",
      '<testsuites><testcase name="x"/></testsuites>',
      1,
      "bun",
      true
    ).status
  ).toBe("failed");
  expect(
    testEvidence("test", '<testsuites><testcase name="x"/></testsuites>', 1)
      .status
  ).toBe("blocked");
});
test("service pins cannot redirect to another registry or accept a partial digest", () => {
  const digest = "a".repeat(64);

  expect(selectImage([`postgres:17@sha256:${digest}`], "postgres")).toBe(
    `postgres:17@sha256:${digest}`
  );

  for (const bad of [
    `postgres:5000/evil/pg:17@sha256:${digest}`,
    `postgres:17@sha256:${digest}bad`,
    `postgres:17@sha256:${digest}/x`,
  ]) {
    expect(() => selectImage([bad], "postgres")).toThrow();
  }
});
test("existing subjects fail generator preflight before writes", () => {
  expect(() =>
    planAccountResource(root, "Sites", "team-read-admin-write")
  ).toThrow("ACL subject already exists");
});
test("checkout locks coordinate separate operations and dead recovery is explicit", () => {
  const dir = mkdtempSync(join(tmpdir(), "bs-lock-test-"));

  try {
    const release = acquireWorkspace(dir);

    expect(() => acquireWorkspace(dir)).toThrow("checkout_locked");
    expect(() => {
      recoverWorkspace(dir, "checkout");
    }).toThrow("Writer still alive");
    release();
    writeFileSync(
      join(dir, ".agent-state/checkout.lock"),
      JSON.stringify({ pid: 2147483647 })
    );
    expect(() => acquireWorkspace(dir)).toThrow("checkout_locked");
    recoverWorkspace(dir, "checkout");
    acquireWorkspace(dir)();
    mkdirSync(join(dir, "plain"));
    expect(() => identifyCheckout(join(dir, "plain"))).toThrow(
      "checkout_requires_git"
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("UI wrapper distinguishes coverage and warning failures from process errors", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bs-wrapper-test-"));

  try {
    mkdirSync(join(dir, "node_modules/vitest"), { recursive: true });
    writeFileSync(
      join(dir, "wrapper.ts"),
      readFileSync(
        join(root, "apps/ui/scripts/quality/run-tests-clean.ts"),
        "utf8"
      )
    );

    for (const [source, code] of [
      [
        'console.error("ERROR: Coverage for lines (50%) does not meet global threshold (80%)");process.exit(1);',
        86,
      ],
      ['console.warn("[WARN] forbidden");', 86],
      ['throw new Error("fixture unavailable");', 1],
      ['console.log("complete");', 0],
    ] as const) {
      writeFileSync(join(dir, "node_modules/vitest/vitest.mjs"), source);
      const result = await runProcess([process.execPath, "wrapper.ts"], {
        cwd: dir,
      });

      expect(result.code).toBe(code);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("record-scope mutants hit both reference predicates and refuse drift", async () => {
  const edits = await formatEdits(
    root,
    planAccountResource(root, "Projects", "team-read-admin-write")
  );
  const service = requireValue(
    edits.find((plannedEdit) =>
      plannedEdit.path.endsWith("projects.service.ts")
    ),
    "Required fixture edit is absent"
  ).after;

  for (const index of [0, 1] as const) {
    expect(withoutRecordAccountPredicate(service, index)).not.toBe(service);
  }

  expect(() =>
    withoutRecordAccountPredicate("unrecognized implementation", 0)
  ).toThrow();
});

test("inventory observations cannot be accepted after source changes", () => {
  const dir = mkdtempSync(join(tmpdir(), "bs-inventory-test-"));

  try {
    execFileSync("git", ["init", "-q", dir]);
    writeFileSync(join(dir, ".gitignore"), ".agent-state/\n");
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
    const xml =
      '<testsuites><testcase file="a.ts" name="control"/></testsuites>';
    const result = inventoryEvidence(
      dir,
      "api.tests",
      xml,
      { checkId: "api.tests", status: "passed", reason: "tests_passed" },
      identifyCheckout(dir).fingerprint
    );

    expect(result.status).toBe("blocked");
    acceptInventories(dir, ["api.tests"]);
    expect(
      inventoryEvidence(
        dir,
        "api.tests",
        xml,
        { checkId: "api.tests", status: "passed", reason: "tests_passed" },
        identifyCheckout(dir).fingerprint
      ).status
    ).toBe("passed");
    writeFileSync(join(dir, "changed.ts"), "export const changed=true;");
    expect(() => {
      acceptInventories(dir, ["api.tests"]);
    }).toThrow("stale");
    expect(
      existsSync(join(dir, "tools/agent/inventories/api.tests.json"))
    ).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ignored XML content cannot create structural tags by joining fragments", () => {
  for (const ignored of ["<!-- ignored -->", "<![CDATA[ignored]]>"]) {
    const xml = `<testsuites><test${ignored}case file="a.ts" name="invented"/></testsuites>`;

    expect(identities(xml, "/root")).toEqual([]);
    expect(testEvidence("test", xml, 0).status).toBe("blocked");
  }
});
