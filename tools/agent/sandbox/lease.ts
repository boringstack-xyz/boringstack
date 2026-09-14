import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { now } from "../../../apps/api/src/lib/time/now";
import { errorHasCode } from "../validation";
import { recoverDeadLock } from "../workspace-lock";
import { readSandbox } from "./lifecycle";

/** Same sandbox cannot back concurrent destructive integration suites. */
export function acquireLease(root: string, id: string): () => void {
  readSandbox(root, id);
  const path = join(root, ".agent-state/sandboxes", `${id}.lock`);
  const token = JSON.stringify({
    pid: process.pid,
    createdAt: now(),
    nonce: crypto.randomUUID(),
  });
  let fd: number;

  try {
    fd = openSync(path, "wx", 0o600);
  } catch (error) {
    if (!errorHasCode(error, "EEXIST")) {
      throw error;
    }

    throw new Error(
      `lease_locked: ${path}; inspect the owner, then run agent:recover -- lease --id=${id} --acknowledge-partial-writes`,
      { cause: error }
    );
  }

  try {
    writeFileSync(fd, token);
  } finally {
    closeSync(fd);
  }

  return () => {
    if (existsSync(path) && readFileSync(path, "utf8") === token) {
      rmSync(path);
    }
  };
}

/** Interrupted verification may leave partial test state; recovery is explicit. */
export function recoverLease(root: string, id: string): void {
  readSandbox(root, id);
  recoverDeadLock(join(root, ".agent-state/sandboxes", `${id}.lock`));
}
