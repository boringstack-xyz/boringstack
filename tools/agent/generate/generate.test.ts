import { expect, test } from "bun:test";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planAccountResource } from "./account-resource";
import { copyFixture } from "./fixture";
import { formatEdits } from "./format";
import { apply, replaceOnce } from "./patch";

const root = join(import.meta.dir, "../../..");

test("all patch preconditions are checked before any write", () => {
  const dir = mkdtempSync(join(tmpdir(), "bs-patch-"));

  try {
    writeFileSync(join(dir, "existing.ts"), "export const value=1;");
    expect(() => {
      apply(dir, [
        { path: "new.ts", before: null, after: "export const n=1;" },
        {
          path: "existing.ts",
          before: "stale",
          after: "export const value=2;",
        },
      ]);
    }).toThrow();
    expect(existsSync(join(dir, "new.ts"))).toBe(false);
    expect(readFileSync(join(dir, "existing.ts"), "utf8")).toBe(
      "export const value=1;"
    );
    expect(() => {
      apply(dir, [{ path: "../escape.ts", before: null, after: "" }]);
    }).toThrow();
    symlinkSync(join(dir, "existing.ts"), join(dir, "link.ts"));
    expect(() => {
      apply(dir, [
        { path: "link.ts", before: "export const value=1;", after: "" },
      ]);
    }).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("a second generator cannot write through a held lease", () => {
  const dir = mkdtempSync(join(tmpdir(), "bs-generator-lock-"));

  try {
    mkdirSync(join(dir, ".agent-state"));
    writeFileSync(join(dir, ".agent-state/generator.lock"), "held");
    expect(() => {
      apply(dir, [
        { path: "new.ts", before: null, after: "export const n=1;" },
      ]);
    }).toThrow();
    expect(existsSync(join(dir, "new.ts"))).toBe(false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ambiguous anchors refuse speculative patching", () => {
  expect(() => replaceOnce("x x", "x", "y")).toThrow();
  expect(() => replaceOnce("none", "x", "y")).toThrow();
});
test("account generation works in a stripped and already extended checkout", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bs-generate-"));

  try {
    copyFixture(root, dir);
    expect(existsSync(join(dir, "apps/docs"))).toBe(false);
    expect(lstatSync(join(dir, "apps/api/node_modules")).isSymbolicLink()).toBe(
      false
    );
    const dependency = "apps/api/node_modules/typescript/package.json";
    const original = readFileSync(join(root, dependency), "utf8");

    writeFileSync(join(dir, dependency), original + "\n");
    expect(readFileSync(join(root, dependency), "utf8")).toBe(original);
    const first = await formatEdits(
      dir,
      planAccountResource(dir, "Projects", "team-read-admin-write")
    );

    apply(dir, first, true);
    expect(existsSync(join(dir, "apps/api/src/api/projects"))).toBe(false);
    apply(dir, first);
    const before = readFileSync(
      join(dir, "apps/api/src/config/routes/routes.ts"),
      "utf8"
    );

    expect(() =>
      planAccountResource(dir, "Projects", "team-read-admin-write")
    ).toThrow();
    expect(
      readFileSync(join(dir, "apps/api/src/config/routes/routes.ts"), "utf8")
    ).toBe(before);
    apply(
      dir,
      await formatEdits(
        dir,
        planAccountResource(dir, "Widgets", "team-read-admin-write")
      )
    );
    expect(
      readFileSync(join(dir, "apps/api/src/lib/acl/acl.constants.ts"), "utf8")
    ).toContain('"Widget"');
    expect(() => planAccountResource(dir, "Teams", "guess")).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 120000);
