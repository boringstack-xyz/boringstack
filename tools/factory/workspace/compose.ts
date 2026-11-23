import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { slotComposeArgs, slotEnvFileText } from "./compose.utils";

export const composeDirOf = (workspace: string): string =>
  join(workspace, "infra", "compose", "compose");

/** Writes the slot's env file under the workspace's state folder. */
export const writeSlotEnv = (stateDir: string, slot: number): string => {
  mkdirSync(stateDir, { recursive: true });
  const file = join(stateDir, "slot.vars");

  writeFileSync(file, slotEnvFileText(slot), { mode: 0o600 });

  return file;
};

export interface IComposeRun {
  readonly code: number | null;
  readonly error: string | undefined;
}

/**
 * Runs `docker compose` for one slot from its workspace. Output goes to
 * `logPath` (or is discarded), so the terminal only shows the factory's lines.
 */
export const runSlotCompose = (
  workspace: string,
  stateDir: string,
  slot: number,
  args: readonly string[],
  logPath: string | undefined,
  timeoutMs: number
): IComposeRun => {
  const envFile = writeSlotEnv(stateDir, slot);
  let fd: number | "ignore" = "ignore";

  if (logPath !== undefined) {
    mkdirSync(stateDir, { recursive: true });
    fd = openSync(logPath, "w", 0o600);
  }

  try {
    const run = spawnSync(
      "docker",
      ["compose", "--env-file", envFile, ...slotComposeArgs(slot), ...args],
      {
        cwd: composeDirOf(workspace),
        stdio: ["ignore", fd, fd],
        timeout: timeoutMs,
      }
    );

    return { code: run.status, error: run.error?.message };
  } finally {
    if (typeof fd === "number") {
      closeSync(fd);
    }
  }
};

/** Whether the Docker daemon answers; false when it is down or missing. */
export const dockerUp = (): boolean =>
  spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
    encoding: "utf8",
    timeout: 15_000,
  }).status === 0;
