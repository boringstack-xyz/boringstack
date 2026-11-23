/*
 * The factory's only door to process.env (lint: env-access). Everything a
 * command reads from the environment is named here, so the surface is one
 * file long.
 */
export interface IFactoryEnvironment {
  /** Directory shared by every checkout on the machine: slot claims, preview maps, status. */
  readonly sharedDir: string | undefined;
  /** "github" (default) or "linear". */
  readonly tracker: string | undefined;
  readonly linearApiKey: string | undefined;
  /** Session id Claude Code / Codex hand a hook. */
  readonly sessionId: string | undefined;
  readonly home: string | undefined;
  readonly path: string | undefined;
  /** On a shared agent machine: the main checkout's branch must never move. */
  readonly sharedCheckout: boolean;
  /** Set in CI: commands that would touch the shared machine refuse. */
  readonly ci: boolean;
}

/** The environment a child process inherits, plus `extra`. */
export const childEnvironment = (
  extra: Readonly<Record<string, string>> = {}
): Record<string, string | undefined> => ({ ...process.env, ...extra });

export const readEnvironment = (): IFactoryEnvironment => ({
  sharedDir: process.env.FACTORY_SHARED_DIR,
  tracker: process.env.FACTORY_TRACKER,
  linearApiKey: process.env.LINEAR_API_KEY,
  sessionId: process.env.CLAUDE_SESSION_ID ?? process.env.CODEX_SESSION_ID,
  home: process.env.HOME,
  path: process.env.PATH,
  sharedCheckout: process.env.FACTORY_SHARED_CHECKOUT === "true",
  ci: process.env.CI === "true",
});
