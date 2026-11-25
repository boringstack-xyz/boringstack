/* Test helpers shared by the fleet and browse tests: a context on temp folders, and a fake process runner. Never runs Docker, gh or git. */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { IFactoryContext } from "../context";
import { FACTORY_CONFIG } from "../factory.config";
import type { IRunResult, ProcessRunner } from "./process";

export const tempDir = (label: string): string =>
  mkdtempSync(join(tmpdir(), `factory-${label}-`));

/** A factory context rooted at `root`, with its shared folder at `sharedDir`, and no environment set. */
export const contextAt = (
  root: string,
  sharedDir: string
): IFactoryContext => ({
  root,
  stateDir: join(root, ".agent-state", "factory"),
  sharedDir,
  config: FACTORY_CONFIG,
  env: {
    sharedDir: undefined,
    tracker: undefined,
    linearApiKey: undefined,
    sessionId: undefined,
    home: undefined,
    path: undefined,
    sharedCheckout: false,
    ci: false,
    preview: {
      domain: undefined,
      publicScheme: undefined,
      publicPort: undefined,
      authProvider: undefined,
      authClientId: undefined,
      authClientSecret: undefined,
      authCookieSecret: undefined,
      authEmailDomain: undefined,
      authGithubOrg: undefined,
      authGithubTeam: undefined,
    },
  },
  json: false,
});

export interface IFakeRunner {
  readonly run: ProcessRunner;
  /** Every call made, as `program arg arg…`. */
  readonly calls: string[];
}

/**
 * A runner that answers from `answer`; a call it does not answer fails with
 * status 1, so a test that reaches for an unexpected program fails loudly.
 */
export const fakeRunner = (
  answer: (program: string, args: readonly string[]) => IRunResult | undefined
): IFakeRunner => {
  const calls: string[] = [];

  return {
    calls,
    run: (program, args) => {
      calls.push([program, ...args].join(" "));

      return (
        answer(program, args) ?? {
          status: 1,
          stdout: "",
          stderr: `unexpected call: ${program} ${args.join(" ")}`,
        }
      );
    },
  };
};
