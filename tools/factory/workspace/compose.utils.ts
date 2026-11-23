import { stackProject, slotPorts } from "./paths.utils";

/**
 * The dev stack's compose files, as a slot runs them: the base stack, the
 * dev port labels, and the factory overlay that binds every published port to
 * 127.0.0.1. Dev-only services (the marketing site, mailpit, observability)
 * are not part of a slot.
 */
export const SLOT_COMPOSE_FILES = [
  "docker-compose.yml",
  "docker-compose.development-labels.yml",
  "docker-compose.factory.yml",
] as const;

/** `-p <project> -f ... --profile dev` for one slot. */
export const slotComposeArgs = (slot: number): string[] => [
  "-p",
  stackProject(slot),
  ...SLOT_COMPOSE_FILES.flatMap((file) => ["-f", file]),
  "--profile",
  "dev",
];

/**
 * The variables a slot's compose files read. They go in a file passed with
 * `--env-file`, so the host's environment is never changed.
 */
export const slotEnvFileText = (slot: number): string => {
  const ports = slotPorts(slot);
  const values: Record<string, string> = {
    UI_HOST_PORT: String(ports.ui),
    API_HOST_PORT: String(ports.api),
    POSTGRES_HOST_PORT: String(ports.postgres),
    VALKEY_HOST_PORT: String(ports.valkey),
    /*
     * The browser reaches the app on the slot's own UI port; the API's links
     * and redirects must point there, not at the default 7331.
     */
    API_DEV_FRONTEND_URL: `http://127.0.0.1:${String(ports.ui)}`,
    API_DEV_PUBLIC_API_URL: `http://127.0.0.1:${String(ports.ui)}/api`,
  };

  return `${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
};
