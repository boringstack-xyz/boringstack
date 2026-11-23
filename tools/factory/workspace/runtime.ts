import { resolve } from "node:path";

import type { IFactoryContext } from "../context";
import { readJson, writeJson } from "../state";
import { parseClaim, type IClaim } from "./claims";
import { mainCheckoutOf, slotFileOf } from "./paths";

/** Where a workspace command runs and where its machine-wide state lives. */
export interface IRuntime {
  /** The main checkout (its parent holds the workspaces folder). */
  readonly main: string;
  /** Machine-wide claims, status and preview records. */
  readonly shared: string;
  /** The checkout this command runs in. */
  readonly workspace: string;
  readonly stateDir: string;
}

/**
 * Shared state lives in the main checkout's `.agent-state`, so every worktree
 * on the machine sees the same claims, unless FACTORY_SHARED_DIR says otherwise.
 */
export const runtimeOf = (context: IFactoryContext): IRuntime => {
  const main = mainCheckoutOf(context.root);

  return {
    main,
    shared: context.sharedDir,
    // Normalized the way the claim stores it, so records compare as strings.
    workspace: resolve(context.root),
    stateDir: context.stateDir,
  };
};

/** The slot this checkout holds, from its slot file; undefined when none. */
export const slotOfCheckout = (workspace: string): IClaim | undefined =>
  parseClaim(readJson(slotFileOf(workspace)));

export const writeSlotOfCheckout = (workspace: string, claim: IClaim): void => {
  writeJson(slotFileOf(workspace), claim);
};
