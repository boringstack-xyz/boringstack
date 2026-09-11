import { dirname, join, resolve } from "node:path";
import ts from "../../../apps/api/node_modules/typescript";
import type { IEdit } from "./patch";

/** Resolve the entire prospective API program in memory before any generated file is written. */
export function validateGeneratedTypes(
  root: string,
  edits: readonly IEdit[]
): void {
  const apiRoot = join(root, "apps/api");
  const configPath = join(apiRoot, "tsconfig.json");
  const config = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path));

  if (config.error !== undefined) {
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, "\n")
    );
  }

  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    apiRoot,
    undefined,
    configPath
  );
  const overlay = new Map(
    edits.map((plannedEdit) => [
      resolve(root, plannedEdit.path),
      plannedEdit.after,
    ])
  );
  const directories = new Set<string>();

  for (const path of overlay.keys()) {
    for (
      let directory = dirname(path);
      directory !== dirname(directory);
      directory = dirname(directory)
    ) {
      directories.add(directory);
    }
  }

  const host = ts.createCompilerHost(parsed.options);

  host.getCurrentDirectory = () => apiRoot;
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const directoryExists = host.directoryExists?.bind(host);

  host.readFile = (path) => overlay.get(resolve(path)) ?? readFile(path);
  host.fileExists = (path) => overlay.has(resolve(path)) || fileExists(path);
  host.directoryExists = (path) =>
    directories.has(resolve(path)) || directoryExists?.(path) === true;

  host.getSourceFile = (path, languageVersion) => {
    const source = host.readFile(path);

    return source === undefined
      ? undefined
      : ts.createSourceFile(path, source, languageVersion, true);
  };

  const addedFiles = [...overlay.keys()].filter(
    (path) => path.startsWith(`${apiRoot}/`) && /\.tsx?$/.test(path)
  );
  const program = ts.createProgram({
    rootNames: [...new Set([...parsed.fileNames, ...addedFiles])],
    options: { ...parsed.options, noEmit: true, incremental: false },
    host,
  });
  const errors = [
    ...parsed.errors,
    ...ts.getPreEmitDiagnostics(program),
  ].filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);

  if (errors.length > 0) {
    throw new Error(
      ts.formatDiagnostics(errors, {
        getCanonicalFileName: (path) => path,
        getCurrentDirectory: () => root,
        getNewLine: () => "\n",
      })
    );
  }
}
