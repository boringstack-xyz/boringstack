import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import type { IEdit } from "../agent/generate/patch";
import { errorHasCode, parseRecord } from "../agent/validation";

function readCandidate(base: string, path: string): string {
  const file = join(base, path);

  for (let cursor = file; cursor !== base; cursor = dirname(cursor)) {
    if (
      relative(base, cursor).startsWith("..") ||
      lstatSync(cursor).isSymbolicLink()
    ) {
      throw new Error("Candidate source must be a regular local file");
    }
  }

  const stat = lstatSync(file);

  if (!stat.isFile() || stat.size > 2_000_000) {
    throw new Error("Candidate source exceeds file budget");
  }

  return readFileSync(file, "utf8");
}

/** Read only the declared product surface. Tests, gates and evaluator code stay reviewer-owned. */
export function candidateEdits(
  candidate: string,
  edits: readonly IEdit[]
): IEdit[] {
  if (!isAbsolute(candidate)) {
    throw new Error("Candidate must be an absolute checkout path");
  }

  const base = realpathSync(candidate);

  return edits
    .filter(
      (plannedEdit) =>
        (plannedEdit.path.startsWith("apps/api/src/") ||
          plannedEdit.path.startsWith("apps/ui/src/")) &&
        !/\.(test|stories)\./.test(plannedEdit.path)
    )
    .map((plannedEdit) => ({
      ...plannedEdit,
      after: readCandidate(base, plannedEdit.path),
    }));
}

/** Existing migration history must be byte-identical; only appended migration artifacts are accepted. */
export function migrationEdits(root: string, candidate: string): IEdit[] {
  const base = realpathSync(candidate);
  const paths = [
    ...new Bun.Glob("**/*.{sql,json}").scanSync({
      cwd: join(base, "apps/api/drizzle"),
      followSymlinks: false,
    }),
  ];
  const existing = [
    ...new Bun.Glob("**/*.{sql,json}").scanSync({
      cwd: join(root, "apps/api/drizzle"),
    }),
  ];

  if (existing.some((path) => !paths.includes(path))) {
    throw new Error("Candidate removes migration history");
  }

  const edits: IEdit[] = [];

  for (const path of paths) {
    const relativePath = `apps/api/drizzle/${path}`;
    const target = join(root, relativePath);
    let before: string | null = null;

    try {
      before = readFileSync(target, "utf8");
    } catch (error) {
      if (!errorHasCode(error, "ENOENT")) {
        throw error;
      }
    }

    const after = readCandidate(base, relativePath);

    if (before !== null && path !== "meta/_journal.json" && before !== after) {
      throw new Error("Candidate rewrites migration history");
    }

    if (before !== null && path === "meta/_journal.json") {
      const old = parseRecord(before).entries;
      const next = parseRecord(after).entries;

      if (
        !Array.isArray(old) ||
        !Array.isArray(next) ||
        JSON.stringify(next.slice(0, old.length)) !== JSON.stringify(old)
      ) {
        throw new Error("Candidate rewrites migration journal");
      }
    }

    edits.push({ path: relativePath, before, after });
  }

  return edits;
}
