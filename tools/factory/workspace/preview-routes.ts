import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { FACTORY_CONFIG } from "../factory.config";
import { writeText } from "../state";
import { composeDirOf } from "./compose";
import { recordedSlots } from "./records";
import { previewHostOf, slotPorts } from "./paths.utils";
import { routesConf, type IPreviewRoute } from "./preview.utils";

export const PREVIEW_PROJECT = `${FACTORY_CONFIG.project}-preview`;

const previewDirOf = (shared: string): string => join(shared, "preview");

/** The routes every slot with a preview record gets, from those records. */
export const previewRoutes = (shared: string): IPreviewRoute[] =>
  recordedSlots(shared, "preview").map((slot) => ({
    slot,
    host: previewHostOf(slot),
    uiPort: slotPorts(slot).ui,
  }));

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
 * Rewrites the proxy's routes from the preview records and reloads the proxy
 * when it runs. Returns whether a reload happened. Routes are plain files, so
 * this is safe with the proxy stopped.
 */
export const refreshRoutes = (root: string, shared: string): boolean => {
  const dir = previewDirOf(shared);
  const nginx = join(dir, "nginx");

  mkdirSync(nginx, { recursive: true });
  writeText(
    join(nginx, "routes.conf"),
    `${routesConf(previewRoutes(shared))}\n`
  );
  writeFileSync(
    join(dir, "proxy.vars"),
    `FACTORY_PREVIEW_DIR=${dir}\nPREVIEW_PORT=${String(FACTORY_CONFIG.previewPort)}\n`,
    { mode: 0o600 }
  );

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
