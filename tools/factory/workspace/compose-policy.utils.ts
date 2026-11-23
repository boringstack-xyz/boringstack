/**
 * The rules a service in the rendered compose config must follow, for a
 * machine that many stacks share. The rules the repo's validate-guardrails.sh
 * already enforces (digest pins, healthchecks present, rooted caps,
 * no-new-privileges, reservations, credential fallbacks) are run from there,
 * not repeated here. This file adds what it does not cover: a memory limit,
 * rotated logs, and a healthcheck that probes quickly only while starting.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasText = (value: unknown): boolean =>
  typeof value === "string" && value.trim() !== "";

/** Problems for one service; empty when it follows every rule. */
export const serviceProblems = (
  name: string,
  service: Record<string, unknown>
): string[] => {
  const deploy = isRecord(service.deploy) ? service.deploy : {};
  const resources = isRecord(deploy.resources) ? deploy.resources : {};
  const limits = isRecord(resources.limits) ? resources.limits : {};
  const logging = isRecord(service.logging) ? service.logging : {};
  const options = isRecord(logging.options) ? logging.options : {};
  const healthcheck = isRecord(service.healthcheck)
    ? service.healthcheck
    : undefined;
  const memoryLimited = hasText(service.mem_limit) || hasText(limits.memory);
  const rotated = hasText(options["max-size"]) && hasText(options["max-file"]);
  const probesFast =
    healthcheck !== undefined &&
    healthcheck.disable !== true &&
    healthcheck.start_interval === undefined;

  return [
    memoryLimited
      ? null
      : `${name}: no memory limit (deploy.resources.limits.memory)`,
    rotated
      ? null
      : `${name}: logs not rotated (logging: *default-logging, max-size and max-file)`,
    probesFast
      ? `${name}: healthcheck without start_interval (it would probe as often while settled as while starting)`
      : null,
  ].filter((problem): problem is string => problem !== null);
};

/** One line per rule a service breaks, across a rendered config. */
export const configProblems = (config: unknown): string[] => {
  const services =
    isRecord(config) && isRecord(config.services) ? config.services : {};

  return Object.entries(services).flatMap(([name, service]) =>
    isRecord(service)
      ? serviceProblems(name, service)
      : [`${name}: not a service`]
  );
};

/** The variable compose refused to render without, from its error text. */
export const missingVariable = (composeError: string): string | undefined =>
  /required variable ([A-Z][A-Z0-9_]*) is missing a value/u.exec(
    composeError
  )?.[1];
