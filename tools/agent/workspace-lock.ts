import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { errorHasCode, parseRecord } from "./validation";

export type LockKind = "checkout" | "generator";

function lockPath(root: string, kind: LockKind): string {
  const dir = join(root, ".agent-state");

  if (lstatSync(dir, { throwIfNoEntry: false })?.isSymbolicLink() === true) {
    throw new Error("Unsafe state directory");
  }

  mkdirSync(dir, { recursive: true, mode: 0o700 });

  return join(dir, `${kind}.lock`);
}

export function acquireWorkspace(
  root: string,
  kind: LockKind = "checkout"
): () => void {
  const path = lockPath(root, kind);
  const token = JSON.stringify({
    pid: process.pid,
    nonce: crypto.randomUUID(),
  });
  let fd: number;

  try {
    fd = openSync(path, "wx", 0o600);
  } catch {
    throw new Error(
      `${kind}_locked: inspect the owning process and partial edits; use agent:recover only after it exits`
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

/** Recovery is explicit: a dead writer may have left partial multi-file edits. */
export function recoverWorkspace(root: string, kind: LockKind): void {
  const path = lockPath(root, kind);

  if (lstatSync(path).isSymbolicLink()) {
    throw new Error("Unsafe lock");
  }

  const before = readFileSync(path, "utf8"),
    pid: unknown = parseRecord(before).pid;

  if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid < 1) {
    throw new Error("Invalid lock; inspect manually");
  }

  try {
    process.kill(pid, 0);

    throw new Error("Writer still alive");
  } catch (error) {
    if (!errorHasCode(error, "ESRCH")) {
      throw error;
    }
  }

  if (readFileSync(path, "utf8") !== before) {
    throw new Error("Lock changed during recovery");
  }

  rmSync(path);
}
