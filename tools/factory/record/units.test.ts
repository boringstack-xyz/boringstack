import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fingerprintUnit, unitByPath } from "./units";

const sh = (cwd: string, ...argv: string[]): void => {
  const [program = "", ...rest] = argv;

  spawnSync(program, rest, { cwd, encoding: "utf8" });
};

describe("unit fingerprints", () => {
  test("follow content, not staging or commits", () => {
    const root = mkdtempSync(join(tmpdir(), "factory-units-"));
    const unit = unitByPath("tools");

    if (unit === undefined) {
      throw new Error("tools is a unit");
    }

    try {
      sh(root, "git", "init", "-q");
      sh(root, "mkdir", "-p", "tools");
      writeFileSync(join(root, "tools", "a.ts"), "one\n");

      const untracked = fingerprintUnit(root, unit);

      sh(root, "git", "add", "-A");
      expect(fingerprintUnit(root, unit)).toBe(untracked);
      sh(
        root,
        "git",
        "-c",
        "user.email=t@t",
        "-c",
        "user.name=t",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-qm",
        "x"
      );
      expect(fingerprintUnit(root, unit)).toBe(untracked);

      writeFileSync(join(root, "tools", "a.ts"), "two\n");
      expect(fingerprintUnit(root, unit)).not.toBe(untracked);

      writeFileSync(join(root, "tools", "README.md"), "docs do not count\n");
      writeFileSync(join(root, "tools", "a.ts"), "one\n");
      expect(fingerprintUnit(root, unit)).toBe(untracked);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
