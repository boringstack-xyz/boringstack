import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fingerprintUnit, stillGreenRecipes, UNITS, unitByPath } from "./units";

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

describe("stillGreenRecipes", () => {
  const verifyUnits = UNITS.filter((unit) => unit.recipe.id === "agent-verify");
  const states = Object.fromEntries(
    verifyUnits.map((unit) => [unit.path, `now-${unit.path}`])
  );

  test("counts a recipe whose every unit passed at its current content", () => {
    expect(
      stillGreenRecipes(verifyUnits, states, states).has("agent-verify")
    ).toBe(true);
  });

  test("not when one unit changed since it passed", () => {
    const [first] = verifyUnits;
    const green = { ...states, [first?.path ?? ""]: "older" };

    expect(
      stillGreenRecipes(verifyUnits, green, states).has("agent-verify")
    ).toBe(false);
  });

  test("not when a unit never passed", () => {
    expect(stillGreenRecipes(verifyUnits, {}, states).size).toBe(0);
  });
});
