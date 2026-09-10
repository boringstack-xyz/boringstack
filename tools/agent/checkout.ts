import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { errorHasCode } from "./validation";

/** Includes uncommitted and untracked non-ignored files; never emits contents. */
export function identifyCheckout(root: string): {
  commit: string;
  fingerprint: string;
} {
  const git = (args: string[]): string =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  let commit: string;

  try {
    commit = git(["rev-parse", "HEAD"]).trim();
  } catch {
    throw new Error("checkout_requires_git");
  }

  const hash = createHash("sha256").update(commit);
  const paths = [
    ...new Set(
      git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
        .split("\0")
        .filter(Boolean)
    ),
  ].sort();

  for (const path of paths) {
    hash.update(path).update("\0");

    try {
      const file = join(root, path);
      const stat = lstatSync(file);

      hash.update(String(stat.mode)).update("\0");

      if (stat.isSymbolicLink()) {
        hash.update(readlinkSync(file));
      } else if (stat.isFile()) {
        hash.update(readFileSync(file));
      } else {
        throw new Error("Unsupported checkout entry");
      }
    } catch (error) {
      if (errorHasCode(error, "ENOENT")) {
        hash.update("deleted");
      } else {
        throw error;
      }
    }

    hash.update("\0");
  }

  return { commit, fingerprint: hash.digest("hex") };
}
