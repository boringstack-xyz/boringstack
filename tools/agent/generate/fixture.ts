import { execFileSync } from "node:child_process";
import { constants, cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** Copy reviewed source, never ignored env/credentials or existing runtime state. */
export function copySource(root: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  const files = execFileSync(
    "git",
    [
      "-C",
      root,
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
    ],
    { encoding: "utf8" }
  )
    .split("\0")
    .filter(Boolean);

  for (const path of new Set(files)) {
    if (
      path.startsWith("apps/docs/") ||
      path.startsWith(".agent-state/") ||
      path.startsWith(".git/")
    ) {
      continue;
    }

    const source = join(root, path);

    if (!existsSync(source)) {
      continue;
    }

    mkdirSync(dirname(join(destination, path)), { recursive: true });
    cpSync(source, join(destination, path), { dereference: false });
  }
}

export function copyFixture(root: string, destination: string): void {
  copySource(root, destination);

  for (const app of ["api", "ui"]) {
    cpSync(
      join(root, "apps", app, "node_modules"),
      join(destination, "apps", app, "node_modules"),
      {
        recursive: true,
        verbatimSymlinks: true,
        mode: constants.COPYFILE_FICLONE,
      }
    );
  }
}

const FIXTURE_RESOURCE_CANDIDATES = [
  "Projects",
  "Widgets",
  "Ledgers",
  "Beacons",
  "Quotas",
  "Tickets",
] as const;

/**
 * Resource names the generator can create in this checkout. A product built
 * on the template may already own `projects` or `widgets`; the tooling tests
 * must exercise the generator without colliding with what the product ships.
 */
export function fixtureResourceNames(root: string, count: number): string[] {
  const free = FIXTURE_RESOURCE_CANDIDATES.filter(
    (name) => !existsSync(join(root, "apps/api/src/api", name.toLowerCase()))
  );

  if (free.length < count) {
    throw new Error("Not enough free fixture resource names in this checkout");
  }

  return free.slice(0, count);
}
