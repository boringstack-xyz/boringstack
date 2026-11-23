import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { git } from "../git";

/*
 * The monorepo's units of verification: each changed unit needs a passing
 * check at its current state before a session may finish. A unit with no
 * recipe cannot be verified, which fails rather than passes.
 */
export interface IRecipe {
  /** Shared runs: units with the same recipe id are verified by one run. */
  readonly id: string;
  readonly summary: string;
  readonly kind: "agent-verify" | "command";
  /** For kind=command: argv run from `cwd` (repo-relative). */
  readonly argv?: readonly string[];
  readonly cwd?: string;
  /**
   * Checks this recipe skips that another recipe of the same run proves:
   * passed to the command as STACK_CHECK_COVERED when that recipe passed.
   */
  readonly coveredBy?: {
    readonly recipe: string;
    readonly checks: readonly string[];
  };
}

export interface IUnit {
  /** Repo-relative path; "." is the repository's own files (scripts, workflows). */
  readonly path: string;
  readonly recipe: IRecipe;
}

const AGENT_VERIFY: IRecipe = {
  id: "agent-verify",
  summary: "agent:verify --profile=feature in an owned sandbox",
  kind: "agent-verify",
};

export const UNITS: readonly IUnit[] = [
  { path: "apps/api", recipe: AGENT_VERIFY },
  { path: "apps/ui", recipe: AGENT_VERIFY },
  { path: "tools", recipe: AGENT_VERIFY },
  { path: "packages", recipe: AGENT_VERIFY },
  {
    path: "apps/docs",
    recipe: {
      id: "docs",
      summary: "apps/docs build:ci",
      kind: "command",
      argv: ["bun", "run", "build:ci"],
      cwd: "apps/docs",
    },
  },
  {
    path: "apps/site",
    recipe: {
      id: "site",
      summary: "apps/site validate",
      kind: "command",
      argv: ["bun", "run", "validate"],
      cwd: "apps/site",
    },
  },
  {
    path: "apps/admin",
    recipe: {
      id: "admin",
      summary: "apps/admin validate",
      kind: "command",
      argv: ["bun", "run", "validate"],
      cwd: "apps/admin",
    },
  },
  {
    path: "infra/compose",
    recipe: {
      id: "compose",
      summary: "infra/compose pre-push gate",
      kind: "command",
      argv: ["bash", "infra/compose/scripts/pre-push.sh"],
      cwd: ".",
    },
  },
  {
    path: "infra/k3s",
    recipe: {
      id: "k3s",
      summary: "infra/k3s tests",
      kind: "command",
      argv: ["bun", "test", "infra/k3s/tests"],
      cwd: ".",
    },
  },
  {
    path: "infra/bootstrap",
    recipe: {
      id: "bootstrap",
      summary: "OpenTofu fmt and validate",
      kind: "command",
      argv: [
        "sh",
        "-c",
        "tofu fmt -check -recursive && tofu init -backend=false -input=false >/dev/null && tofu validate",
      ],
      cwd: "infra/bootstrap",
    },
  },
  {
    path: ".",
    recipe: {
      id: "repo",
      summary: "root bun run check",
      kind: "command",
      coveredBy: { recipe: "agent-verify", checks: ["OpenAPI drift"] },
      argv: ["bun", "run", "check"],
      cwd: ".",
    },
  },
];

/** Documentation is not code: Markdown and docs/ never ask for a check run. */
const pathspec = (unit: IUnit): string[] => {
  const others = UNITS.filter(
    (other) => other.path !== "." && other.path !== unit.path
  ).map((other) => `:(exclude)${other.path}`);

  return [
    "--",
    unit.path,
    ":(exclude)*.md",
    ":(exclude)docs/",
    /* Verification records its own observations here; they are not code. */
    ":(exclude)tools/agent/inventories/",
    ...(unit.path === "." ? others : []),
  ];
};

/**
 * The unit's content: every tracked or new (not ignored) file and what it
 * holds now. Staging and committing do not change it; editing, adding or
 * deleting a file does. So a pass recorded before a commit still holds after.
 */
export const fingerprintUnit = (root: string, unit: IUnit): string => {
  const files = (
    git(root, [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      ...pathspec(unit),
    ]) ?? ""
  )
    .split("\n")
    .filter((file) => file !== "" && existsSync(join(root, file)))
    .sort();
  const run = spawnSync("git", ["-C", root, "hash-object", "--stdin-paths"], {
    input: files.join("\n"),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const hashes = run.status === 0 ? run.stdout.trim().split("\n") : [];

  return createHash("sha256")
    .update(
      files.map((file, index) => `${file} ${hashes[index] ?? "?"}`).join("\n")
    )
    .digest("hex");
};

/** unit path → fingerprint, for every unit present in this checkout. */
export type UnitStates = Readonly<Record<string, string>>;

export const presentUnits = (root: string): IUnit[] =>
  UNITS.filter((unit) => existsSync(join(root, unit.path)));

export const fingerprintAll = (root: string): UnitStates =>
  Object.fromEntries(
    presentUnits(root).map((unit) => [unit.path, fingerprintUnit(root, unit)])
  );

/** Units whose files differ between `base` and the working tree. */
export const changedSince = (root: string, base: string): IUnit[] =>
  presentUnits(root).filter((unit) => {
    const committed = git(root, [
      "diff",
      "--name-only",
      base,
      ...pathspec(unit),
    ]);
    const dirty = git(root, ["status", "--porcelain", ...pathspec(unit)]);

    return (committed ?? "x") !== "" || (dirty ?? "") !== "";
  });

export const unitByPath = (path: string): IUnit | undefined =>
  UNITS.find((unit) => unit.path === path);

/**
 * Recipes whose every present unit last passed at the content it has now
 * (green.json). Such a recipe covers another's skipped checks (coveredBy)
 * without running again in the same verify.
 */
export const stillGreenRecipes = (
  present: readonly IUnit[],
  green: UnitStates,
  states: UnitStates
): Set<string> => {
  const byRecipe = new Map<string, IUnit[]>();

  for (const unit of present) {
    byRecipe.set(unit.recipe.id, [
      ...(byRecipe.get(unit.recipe.id) ?? []),
      unit,
    ]);
  }

  return new Set(
    [...byRecipe]
      .filter(([, units]) =>
        units.every(
          (unit) =>
            states[unit.path] !== undefined &&
            green[unit.path] === states[unit.path]
        )
      )
      .map(([recipe]) => recipe)
  );
};
