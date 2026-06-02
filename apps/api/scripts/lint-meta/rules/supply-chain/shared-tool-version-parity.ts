import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { parsePackageJson } from "../../parsers/package-json";
import type { IMetaRule, IViolation } from "../../types";

/*
 * Dev tooling that must stay in lockstep across every app that declares it.
 * Drift here means two apps lint/format/typecheck with different rule sets —
 * a class of defect that has bitten this repo before. Only apps that actually
 * declare a tool are compared, so an app legitimately omitting one (e.g. the
 * static docs site has no ESLint) is never forced to add it.
 */
const SHARED_TOOLS = [
  "eslint",
  "typescript",
  "prettier",
  "knip",
  "typescript-eslint",
  "eslint-config-prettier",
  "eslint-plugin-import",
  "eslint-plugin-promise",
  "eslint-plugin-sonarjs",
  "eslint-plugin-unicorn",
  "@eslint/js",
  "husky",
] as const;

/*
 * First-party plugin scopes are shared tooling by definition: every app
 * that declares one must lint with the same release. Matched by prefix so
 * new plugins are covered the moment a second app adopts them, without
 * editing this list.
 */
const SHARED_TOOL_PREFIXES = ["@boring-stack-pkg/"] as const;

interface IAppDeps {
  readonly app: string;
  readonly file: string;
  readonly deps: Record<string, string>;
}

function readApps(appsDir: string): IAppDeps[] {
  const out: IAppDeps[] = [];
  let entries: string[];

  try {
    entries = readdirSync(appsDir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    const dir = join(appsDir, entry);

    let isDir: boolean;

    try {
      isDir = statSync(dir).isDirectory();
    } catch {
      continue;
    }

    if (!isDir) {
      continue;
    }

    const file = join(dir, "package.json");
    let text: string;

    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const pkg = parsePackageJson(text);

    if (pkg === null) {
      continue;
    }

    out.push({
      app: entry,
      file,
      deps: { ...pkg.dependencies, ...pkg.devDependencies },
    });
  }

  return out;
}

interface IDeclarer {
  readonly app: string;
  readonly file: string;
  readonly version: string;
}

export function checkSharedToolVersionParity(appsDir: string): IViolation[] {
  const violations: IViolation[] = [];
  const apps = readApps(appsDir);

  const prefixTools = new Set<string>();

  for (const app of apps) {
    for (const dep of Object.keys(app.deps)) {
      if (SHARED_TOOL_PREFIXES.some((prefix) => dep.startsWith(prefix))) {
        prefixTools.add(dep);
      }
    }
  }

  const tools = [...SHARED_TOOLS, ...[...prefixTools].sort()];

  for (const tool of tools) {
    const declarers: IDeclarer[] = apps
      .map((app) => ({ app: app.app, file: app.file, version: app.deps[tool] }))
      .filter((entry): entry is IDeclarer => typeof entry.version === "string");

    if (declarers.length < 2) {
      continue;
    }

    const versions = new Set(declarers.map((entry) => entry.version));

    if (versions.size === 1) {
      continue;
    }

    const summary = declarers
      .map((entry) => `${entry.app}@${entry.version}`)
      .join(", ");

    for (const declarer of declarers) {
      violations.push({
        file: declarer.file,
        rule: "shared-tool-version-parity",
        message: `${tool} version drifts across apps (${summary}) — shared dev tooling must be pinned to one version in every app that declares it.`,
      });
    }
  }

  return violations;
}

/** Shared dev tooling must be pinned to the same version across apps. */
export const sharedToolVersionParityRule: IMetaRule = {
  id: "shared-tool-version-parity",
  category: "supply-chain",
  description:
    "Shared dev tooling (ESLint, TypeScript, Prettier, knip, …) must be pinned to the same version in every app that declares it.",
  run({ root }) {
    return checkSharedToolVersionParity(join(root, ".."));
  },
};
