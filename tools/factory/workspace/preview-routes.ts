import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { FACTORY_CONFIG } from "../factory.config";
import { readEnvironment } from "../environment";
import { writeText } from "../state";
import { composeDirOf } from "./compose";
import { recordedSlots } from "./records";
import { previewHostOf, slotPorts } from "./paths.utils";
import { previewSettingsOf, type IPreviewSettings } from "./preview.config";
import { authUrlOf, routesConf, type IPreviewRoute } from "./preview.utils";

export const PREVIEW_PROJECT = `${FACTORY_CONFIG.project}-preview`;

const previewDirOf = (shared: string): string => join(shared, "preview");

/** The settings in force: PREVIEW_* from this process's environment. */
export const currentPreviewSettings = (): IPreviewSettings =>
  previewSettingsOf(readEnvironment().preview);

/**
 * Whether a login gate is on in the proxy's current variables and this
 * process would turn it off without saying so: the settings have no auth and
 * PREVIEW_AUTH_PROVIDER is not explicitly `off` (`providerSetting` is its
 * value, undefined when unset). A sweep or teardown run without the secrets
 * must not open the proxy, so such a rewrite is refused and the gate stays.
 */
export const gateStaysOn = (
  shared: string,
  settings: IPreviewSettings,
  providerSetting: string | undefined
): boolean => {
  const file = join(previewDirOf(shared), "proxy.vars");

  if (settings.auth !== undefined || !existsSync(file)) {
    return false;
  }

  const gateOn = /^COMPOSE_PROFILES=auth$/mu.test(readFileSync(file, "utf8"));

  return gateOn && providerSetting?.trim() !== "off";
};

/** The routes every slot with a preview record gets, from those records. */
export const previewRoutes = (
  shared: string,
  settings: IPreviewSettings
): IPreviewRoute[] =>
  recordedSlots(shared, "preview").map((slot) => ({
    slot,
    host: previewHostOf(slot, settings.domain),
    uiPort: slotPorts(slot).ui,
  }));

/**
 * The variables the proxy's compose file reads, from the same settings. The
 * auth secrets go in here and nowhere else; the file is written 0600.
 */
export const proxyVarsOf = (
  dir: string,
  settings: IPreviewSettings
): string => {
  const lines = [
    `FACTORY_PREVIEW_DIR=${dir}`,
    `PREVIEW_PORT=${String(FACTORY_CONFIG.previewPort)}`,
    `COMPOSE_PROFILES=${settings.auth === undefined ? "" : "auth"}`,
  ];
  const auth = settings.auth;

  if (auth !== undefined) {
    const redirect = `${authUrlOf(settings)}/oauth2/callback`;

    lines.push(
      `OAUTH2_PROXY_PROVIDER=${auth.provider}`,
      `OAUTH2_PROXY_CLIENT_ID=${auth.clientId}`,
      `OAUTH2_PROXY_CLIENT_SECRET=${auth.clientSecret}`,
      `OAUTH2_PROXY_COOKIE_SECRET=${auth.cookieSecret}`,
      `OAUTH2_PROXY_COOKIE_DOMAINS=.${settings.domain}`,
      `OAUTH2_PROXY_COOKIE_SECURE=${settings.publicScheme === "https" ? "true" : "false"}`,
      `OAUTH2_PROXY_REDIRECT_URL=${redirect}`,
      `OAUTH2_PROXY_WHITELIST_DOMAINS=.${settings.domain}`,
      `OAUTH2_PROXY_EMAIL_DOMAINS=${auth.provider === "google" ? (auth.emailDomain ?? "") : "*"}`,
      `OAUTH2_PROXY_GITHUB_ORG=${auth.githubOrg ?? ""}`,
      `OAUTH2_PROXY_GITHUB_TEAM=${auth.githubTeam ?? ""}`
    );
  }

  return `${lines.join("\n")}\n`;
};

/** Whether the preview proxy container is running (its env file must exist). */
export const proxyRunning = (root: string, shared: string): boolean =>
  spawnSync(
    "docker",
    [
      "compose",
      "-p",
      PREVIEW_PROJECT,
      "-f",
      "preview-proxy.yml",
      "--env-file",
      join(previewDirOf(shared), "proxy.vars"),
      "ps",
      "--status",
      "running",
      "-q",
    ],
    { cwd: composeDirOf(root), encoding: "utf8", timeout: 30_000 }
  ).stdout.trim() !== "";

/**
 * Rewrites the proxy's routes and variables from the preview records and the
 * PREVIEW_* settings, then reloads the proxy when it runs. Returns whether a
 * reload happened. Routes are plain files, so this is safe with the proxy
 * stopped. Settings that are not usable write nothing and return false.
 */
export const refreshRoutes = (root: string, shared: string): boolean => {
  const dir = previewDirOf(shared);
  const nginx = join(dir, "nginx");
  const settings = currentPreviewSettings();

  if (
    settings.problems.length > 0 ||
    gateStaysOn(shared, settings, readEnvironment().preview.authProvider)
  ) {
    return false;
  }

  mkdirSync(nginx, { recursive: true });
  writeText(
    join(nginx, "routes.conf"),
    `${routesConf(previewRoutes(shared, settings), settings)}\n`
  );
  writeFileSync(join(dir, "proxy.vars"), proxyVarsOf(dir, settings), {
    mode: 0o600,
  });

  if (!proxyRunning(root, shared)) {
    return false;
  }

  const run = spawnSync(
    "docker",
    [
      "compose",
      "-p",
      PREVIEW_PROJECT,
      "-f",
      "preview-proxy.yml",
      "--env-file",
      join(dir, "proxy.vars"),
      "exec",
      "-T",
      "preview-proxy",
      "nginx",
      "-s",
      "reload",
    ],
    { cwd: composeDirOf(root), timeout: 60_000 }
  );

  return run.status === 0;
};

/** Removes a slot's preview record and refreshes the routes. */
export const dropPreview = (
  root: string,
  shared: string,
  slot: number
): void => {
  rmSync(join(previewDirOf(shared), `s${String(slot)}.json`), { force: true });
  refreshRoutes(root, shared);
};
