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
  /** Preview proxy settings (`PREVIEW_*`); every one is optional. */
  readonly preview: IPreviewEnvironment;
}

/** The `PREVIEW_*` variables `factory preview` reads. Defaults live in preview.config.ts. */
export interface IPreviewEnvironment {
  readonly domain: string | undefined;
  readonly publicScheme: string | undefined;
  readonly publicPort: string | undefined;
  readonly authProvider: string | undefined;
  readonly authClientId: string | undefined;
  readonly authClientSecret: string | undefined;
  readonly authCookieSecret: string | undefined;
  readonly authEmailDomain: string | undefined;
  readonly authGithubOrg: string | undefined;
  readonly authGithubTeam: string | undefined;
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
  preview: {
    domain: process.env.PREVIEW_DOMAIN,
    publicScheme: process.env.PREVIEW_PUBLIC_SCHEME,
    publicPort: process.env.PREVIEW_PUBLIC_PORT,
    authProvider: process.env.PREVIEW_AUTH_PROVIDER,
    authClientId: process.env.PREVIEW_AUTH_CLIENT_ID,
    authClientSecret: process.env.PREVIEW_AUTH_CLIENT_SECRET,
    authCookieSecret: process.env.PREVIEW_AUTH_COOKIE_SECRET,
    authEmailDomain: process.env.PREVIEW_AUTH_EMAIL_DOMAIN,
    authGithubOrg: process.env.PREVIEW_AUTH_GITHUB_ORG,
    authGithubTeam: process.env.PREVIEW_AUTH_GITHUB_TEAM,
  },
});
