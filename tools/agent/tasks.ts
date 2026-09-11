import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isProfile } from "./checks";
import { isRecord, isStringArray, parseRecord } from "./validation";

export function inspectTask(root: string, id: string): object {
  if (id !== "account-resource") {
    throw new Error("Unknown task ID");
  }

  const raw = readFileSync(join(root, `tools/agent/tasks/${id}.json`), "utf8");

  if (Buffer.byteLength(raw) > 8192) {
    throw new Error("Task metadata exceeds context budget");
  }

  const task = parseRecord(raw);

  if (
    task.schemaVersion !== 1 ||
    task.id !== id ||
    typeof task.verificationProfile !== "string" ||
    !isProfile(task.verificationProfile) ||
    !isStringArray(task.commands) ||
    !isStringArray(task.guides) ||
    !isStringArray(task.integrationPoints)
  ) {
    throw new Error("Unsupported task contract");
  }

  const scripts = parseRecord(
    readFileSync(join(root, "package.json"), "utf8")
  ).scripts;

  if (!isRecord(scripts)) {
    throw new Error("Package has no script map");
  }

  for (const command of task.commands) {
    if (typeof command !== "string" || typeof scripts[command] !== "string") {
      throw new Error("Task command drift");
    }
  }

  for (const path of [...task.guides, ...task.integrationPoints]) {
    if (
      typeof path !== "string" ||
      path.includes("..") ||
      path.startsWith("/") ||
      !existsSync(join(root, path))
    ) {
      throw new Error("Task path drift");
    }
  }

  return task;
}
