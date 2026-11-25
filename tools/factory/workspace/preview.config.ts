import { FACTORY_CONFIG } from "../factory.config";
import type { IPreviewEnvironment } from "../environment";

/**
 * Preview settings, read from the PREVIEW_* environment. Pure: nothing here
 * touches the disk or the network, so the rules are tested directly.
 *
 * Auth is optional and off by default. When on, oauth2-proxy sits in front of
 * every slot and one login on `auth.<domain>` covers every `s<N>.<domain>`
 * (the cookie is scoped to `.<domain>`).
 */

export type PreviewAuthProvider = "google" | "github";

export interface IPreviewAuth {
  readonly provider: PreviewAuthProvider;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly cookieSecret: string;
  /** Google: the email domain a person must have (for example example.com). */
  readonly emailDomain: string | undefined;
  /** GitHub: the organisation a person must belong to. */
  readonly githubOrg: string | undefined;
  /** GitHub: optionally narrow to one team of that organisation. */
  readonly githubTeam: string | undefined;
}

export interface IPreviewSettings {
  /** Parent domain of every preview host: `s<N>.<domain>`. */
  readonly domain: string;
  /** The scheme and port a browser uses (a TLS tunnel in front of the proxy uses https and 443). */
  readonly publicScheme: "http" | "https";
  readonly publicPort: number;
  /** Set only when PREVIEW_AUTH_PROVIDER names a provider. */
  readonly auth: IPreviewAuth | undefined;
  /** Why the settings cannot be used; empty when they can. */
  readonly problems: readonly string[];
}

const DOMAIN_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/u;
/** oauth2-proxy accepts a cookie secret of exactly 16, 24 or 32 bytes. */
const COOKIE_SECRET_LENGTHS: readonly number[] = [16, 24, 32];

const present = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === "" ? undefined : value.trim();

/** `https://host` or `http://host:port`, with the default port left out. */
export const originOf = (
  settings: Pick<IPreviewSettings, "publicScheme" | "publicPort">,
  host: string
): string => {
  const defaultPort = settings.publicScheme === "https" ? 443 : 80;
  const port =
    settings.publicPort === defaultPort
      ? ""
      : `:${String(settings.publicPort)}`;

  return `${settings.publicScheme}://${host}${port}`;
};

export const previewSettingsOf = (
  env: IPreviewEnvironment
): IPreviewSettings => {
  const problems: string[] = [];
  const domain = (
    present(env.domain) ?? FACTORY_CONFIG.previewHost
  ).toLowerCase();

  if (!DOMAIN_PATTERN.test(domain)) {
    problems.push(`PREVIEW_DOMAIN "${domain}" is not a domain name`);
  }

  const scheme = present(env.publicScheme) ?? "http";

  if (scheme !== "http" && scheme !== "https") {
    problems.push('PREVIEW_PUBLIC_SCHEME must be "http" or "https"');
  }

  const portText = present(env.publicPort);
  const port =
    portText === undefined ? FACTORY_CONFIG.previewPort : Number(portText);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push("PREVIEW_PUBLIC_PORT must be a port number");
  }

  const settings = {
    domain,
    publicScheme: scheme === "https" ? "https" : "http",
    publicPort: port,
  } as const;

  const provider = present(env.authProvider) ?? "off";
  const auth = authOf(env, provider, problems);

  return { ...settings, auth, problems };
};

const authOf = (
  env: IPreviewEnvironment,
  provider: string,
  problems: string[]
): IPreviewAuth | undefined => {
  if (provider === "off") {
    return undefined;
  }

  if (provider !== "google" && provider !== "github") {
    problems.push('PREVIEW_AUTH_PROVIDER must be "off", "google" or "github"');

    return undefined;
  }

  const clientId = present(env.authClientId);
  const clientSecret = present(env.authClientSecret);
  const cookieSecret = present(env.authCookieSecret);
  const emailDomain = present(env.authEmailDomain);
  const githubOrg = present(env.authGithubOrg);
  const githubTeam = present(env.authGithubTeam);

  if (clientId === undefined) {
    problems.push("PREVIEW_AUTH_CLIENT_ID is required with a login provider");
  }

  if (clientSecret === undefined) {
    problems.push(
      "PREVIEW_AUTH_CLIENT_SECRET is required with a login provider"
    );
  }

  if (
    cookieSecret === undefined ||
    !COOKIE_SECRET_LENGTHS.includes(Buffer.byteLength(cookieSecret, "utf8"))
  ) {
    problems.push(
      "PREVIEW_AUTH_COOKIE_SECRET must be 16, 24 or 32 bytes (for example: openssl rand -hex 16)"
    );
  }

  if (provider === "google" && emailDomain === undefined) {
    problems.push(
      "PREVIEW_AUTH_EMAIL_DOMAIN is required with google: only that email domain may enter"
    );
  }

  if (provider === "github" && githubOrg === undefined) {
    problems.push(
      "PREVIEW_AUTH_GITHUB_ORG is required with github: only members of that organisation may enter"
    );
  }

  if (
    provider === "github" &&
    githubTeam !== undefined &&
    githubOrg === undefined
  ) {
    problems.push("PREVIEW_AUTH_GITHUB_TEAM needs PREVIEW_AUTH_GITHUB_ORG");
  }

  if (
    clientId === undefined ||
    clientSecret === undefined ||
    cookieSecret === undefined
  ) {
    return undefined;
  }

  return {
    provider,
    clientId,
    clientSecret,
    cookieSecret,
    emailDomain,
    githubOrg,
    githubTeam,
  };
};
