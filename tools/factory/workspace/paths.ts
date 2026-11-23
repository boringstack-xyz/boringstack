import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

import { FACTORY_CONFIG } from "../factory.config";
import { git } from "../git";

/**
 * The main checkout, from any worktree of the repo. Its parent holds the
 * workspaces folder; its `.agent-state` holds the machine-wide shared state.
 */
export const mainCheckoutOf = (root: string): string => {
  const common = git(root, [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);

  return common === undefined ? root : dirname(common);
};

/** `../<project>-workspaces` next to the main checkout. */
export const workspacesDirOf = (main: string): string =>
  resolve(main, "..", `${FACTORY_CONFIG.project}-workspaces`);

export const workspacePathOf = (main: string, name: string): string =>
  join(workspacesDirOf(main), name);

/** Per-checkout slot record, ignored by git. */
export const slotFileOf = (workspace: string): string =>
  join(workspace, ".agent-state", "factory", "slot.json");

/** Per-checkout state folder for logs and records. */
export const stateDirOf = (workspace: string): string =>
  join(workspace, ".agent-state", "factory");

/**
 * Runs a git command for its exit status and output, keeping stderr so a
 * refusal can say why.
 */
export const gitRun = (
  dir: string,
  args: readonly string[],
  timeoutMs = 120_000
): { ok: boolean; out: string; err: string } => {
  const run = spawnSync("git", ["-C", dir, ...args], {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });

  return {
    ok: run.status === 0,
    out: run.stdout.trim(),
    err: run.stderr.trim(),
  };
};
