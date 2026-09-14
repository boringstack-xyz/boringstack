import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readSandbox } from "./lifecycle";
import { acquireLease, recoverLease } from "./lease";

test("lease recovery preserves live owners and reclaims exited owners", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "bs-lease-")));
  const id = "a".repeat(32);
  const directory = join(root, ".agent-state/sandboxes");
  const lock = join(directory, `${id}.lock`);

  try {
    expect(() => readSandbox(root, id)).toThrow("sandbox_not_found:");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, `${id}.json`),
      JSON.stringify({
        version: 1,
        id,
        root,
        owner: createHash("sha256").update(root).digest("hex"),
        createdAt: "2026-09-14T00:00:00.000Z",
        password: "a".repeat(48),
        valkeyPassword: "b".repeat(48),
        postgres: "",
        valkey: "",
        postgresPort: 1,
        valkeyPort: 2,
      })
    );
    const release = acquireLease(root, id);
    const original = readFileSync(lock, "utf8");

    expect(() => acquireLease(root, id)).toThrow("lease_locked:");
    expect(() => {
      recoverLease(root, id);
    }).toThrow("Writer still alive");
    expect(readFileSync(lock, "utf8")).toBe(original);
    release();
    expect(existsSync(lock)).toBe(false);

    const exited = spawnSync(process.execPath, ["-e", "process.exit(0)"]);

    expect(exited.status).toBe(0);
    writeFileSync(lock, JSON.stringify({ pid: exited.pid }));
    recoverLease(root, id);
    expect(existsSync(lock)).toBe(false);

    const releaseOld = acquireLease(root, id);

    writeFileSync(lock, original);
    releaseOld();
    expect(readFileSync(lock, "utf8")).toBe(original);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
