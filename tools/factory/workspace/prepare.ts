import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The part of setup.sh a workspace needs. Docker bind-mounts apps/api and
 * apps/ui into the slot's containers; without these folders it creates them as
 * root-owned stubs inside the checkout. The dev stack keeps its dependencies in
 * named volumes, so no host install runs here: host checks (agent:quality)
 * still need `bun install` inside apps/api and apps/ui.
 */
export const SETUP_DIRECTORIES = [
  "apps/api/node_modules",
  "apps/ui/node_modules",
  "apps/api/src/templates/email/dist",
] as const;

export const prepareCheckout = (path: string): void => {
  for (const directory of SETUP_DIRECTORIES) {
    mkdirSync(join(path, directory), { recursive: true });
  }
};
