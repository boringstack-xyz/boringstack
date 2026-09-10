import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import ts from "../../../apps/api/node_modules/typescript";
import { acquireWorkspace } from "../workspace-lock";

export interface IEdit {
  path: string;
  before: string | null;
  after: string;
}

export function edit(
  root: string,
  path: string,
  transform: (source: string) => string
): IEdit {
  const file = join(root, path);
  const before = existsSync(file) ? readFileSync(file, "utf8") : null;

  return { path, before, after: transform(before ?? "") };
}

export function replaceOnce(
  source: string,
  before: string,
  after: string
): string {
  if (source.split(before).length !== 2) {
    throw new Error(`Expected one patch anchor: ${before.slice(0, 60)}`);
  }

  return source.replace(before, after);
}

function validateEdit(
  root: string,
  plannedEdit: IEdit,
  paths: Set<string>
): void {
  const file = resolve(root, plannedEdit.path);

  if (
    isAbsolute(plannedEdit.path) ||
    plannedEdit.path.split("/").some((part) => part === ".." || part === ".") ||
    file === resolve(root) ||
    relative(root, file).startsWith("..") ||
    paths.has(file)
  ) {
    throw new Error("Invalid or duplicate patch path");
  }

  paths.add(file);
  let cursor = file;

  while (cursor !== resolve(root)) {
    if (
      lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink() === true
    ) {
      throw new Error("Refusing symlink patch target");
    }

    cursor = dirname(cursor);
  }

  const current = existsSync(file) ? readFileSync(file, "utf8") : null;

  if (current !== plannedEdit.before) {
    throw new Error("Target changed during planning");
  }

  if (!/\.tsx?$/.test(plannedEdit.path)) {
    return;
  }

  const compiled = ts.transpileModule(plannedEdit.after, {
    fileName: plannedEdit.path,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });

  if (
    compiled.diagnostics?.some(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
    ) === true
  ) {
    throw new Error(`Invalid generated TypeScript: ${plannedEdit.path}`);
  }
}

function atomicWrite(file: string, content: string): void {
  const temp = join(dirname(file), `.agent-write-${crypto.randomUUID()}`);

  try {
    writeFileSync(temp, content, {
      flag: "wx",
      mode: lstatSync(file, { throwIfNoEntry: false })?.mode ?? 0o644,
    });
    renameSync(temp, file);
  } finally {
    rmSync(temp, { force: true });
  }
}

function rollbackWrites(root: string, written: IEdit[], dirs: string[]): void {
  for (const plannedEdit of written.reverse()) {
    if (
      !existsSync(join(root, plannedEdit.path)) ||
      readFileSync(join(root, plannedEdit.path), "utf8") !== plannedEdit.after
    ) {
      continue;
    }

    if (plannedEdit.before === null) {
      rmSync(join(root, plannedEdit.path), { force: true });
    } else {
      atomicWrite(join(root, plannedEdit.path), plannedEdit.before);
    }
  }

  for (const dir of dirs.reverse()) {
    try {
      rmdirSync(dir);
    } catch {
      /* Preserve nonempty directories. */
    }
  }
}

/** Validate all original bytes and syntax before writing; rollback this invocation's writes on failure. */
export function apply(
  root: string,
  edits: readonly IEdit[],
  dryRun = false
): void {
  const paths = new Set<string>();

  for (const plannedEdit of edits) {
    validateEdit(root, plannedEdit, paths);
  }

  if (dryRun) {
    return;
  }

  const state = join(root, ".agent-state");

  if (lstatSync(state, { throwIfNoEntry: false })?.isSymbolicLink() === true) {
    throw new Error("Refusing symlink state directory");
  }

  mkdirSync(state, { recursive: true, mode: 0o700 });
  const releaseCheckout = acquireWorkspace(root);
  let releaseGenerator: () => void;

  try {
    releaseGenerator = acquireWorkspace(root, "generator");
  } catch (error) {
    releaseCheckout();

    throw error;
  }

  const written: IEdit[] = [];
  const dirs: string[] = [];

  try {
    for (const plannedEdit of edits) {
      const file = join(root, plannedEdit.path);
      const missing: string[] = [];

      for (let dir = dirname(file); !existsSync(dir); dir = dirname(dir)) {
        missing.unshift(dir);
      }

      for (const dir of missing) {
        mkdirSync(dir);
        dirs.push(dir);
      }

      // The lock coordinates generators; compare bytes again to detect editor changes.
      if (
        (existsSync(file) ? readFileSync(file, "utf8") : null) !==
        plannedEdit.before
      ) {
        throw new Error("Concurrent edit");
      }

      atomicWrite(file, plannedEdit.after);
      written.push(plannedEdit);
    }
  } catch (error) {
    rollbackWrites(root, written, dirs);

    throw error;
  } finally {
    releaseGenerator();
    releaseCheckout();
  }
}
