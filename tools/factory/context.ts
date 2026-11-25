import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { type IFactoryEnvironment, readEnvironment } from "./environment";
import { mainCheckoutOf } from "./git";
import { FACTORY_CONFIG } from "./factory.config";

/** What every command receives: where it runs and what it may touch. */
export interface IFactoryContext {
  /** The checkout this command runs in (main checkout or a workspace worktree). */
  readonly root: string;
  /** Ignored, per-checkout state: `.agent-state/factory`. */
  readonly stateDir: string;
  /** Machine-wide coordination directory (claims, preview maps, fleet status). */
  readonly sharedDir: string;
  readonly config: typeof FACTORY_CONFIG;
  readonly env: IFactoryEnvironment;
  readonly json: boolean;
}

/* resolve() drops the URL's trailing slash, so the root compares equal to the
   workspace path a slot claim records. */
export const repoRoot = (): string =>
  resolve(fileURLToPath(new URL("../../", import.meta.url)));

export const createContext = (
  json: boolean,
  root: string = repoRoot()
): IFactoryContext => {
  const env = readEnvironment();
  const stateDir = join(root, ".agent-state", "factory");

  return {
    root,
    stateDir,
    /* The main checkout's, so every workspace on the machine shares it. */
    sharedDir:
      env.sharedDir ??
      join(mainCheckoutOf(root), ".agent-state", "factory", "shared"),
    config: FACTORY_CONFIG,
    env,
    json,
  };
};

/** The product's package name, for messages. */
export const productName = (root: string): string => {
  const parsed: unknown = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8")
  );

  return typeof parsed === "object" &&
    parsed !== null &&
    "name" in parsed &&
    typeof parsed.name === "string"
    ? parsed.name
    : FACTORY_CONFIG.project;
};
