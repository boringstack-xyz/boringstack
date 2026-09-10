import { closeSync, openSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { now } from "../../../apps/api/src/lib/time/now";
import { readSandbox } from "./lifecycle";

/** Same sandbox cannot back concurrent destructive integration suites. */
export function acquireLease(root: string, id: string): () => void {
  readSandbox(root, id);
  const path = join(root, ".agent-state/sandboxes", `${id}.lock`);
  const fd = openSync(path, "wx", 0o600);

  try {
    writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: now() }));
  } finally {
    closeSync(fd);
  }

  return () => {
    rmSync(path, { force: true });
  };
}
