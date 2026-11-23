/*
 * Pure parts of `factory fleet`: Docker's JSON lines, sizes, and the one
 * summary per stack. No Docker or file access here (fleet.data.ts does that).
 */
import { FACTORY_CONFIG } from "../factory.config";
import { isRecord } from "../state";
import type { IStatusLine, ISlotClaim, IVerifyResult } from "./slots.utils";
import { projectOfSlot } from "./slots.utils";

export const COMPOSE_PROJECT_LABEL = "com.docker.compose.project";
export const COMPOSE_SERVICE_LABEL = "com.docker.compose.service";
export const COMPOSE_WORKDIR_LABEL = "com.docker.compose.project.working_dir";

/** One container, as `docker ps --format json` describes it. */
export interface IContainer {
  readonly name: string;
  readonly project: string;
  readonly service: string;
  readonly workingDir: string;
  readonly state: string;
  readonly status: string;
  readonly ports: string;
}

/** One running container's resource use, as `docker stats --format json` describes it. */
export interface IStat {
  readonly name: string;
  readonly memoryMiB: number;
  readonly cpuPercent: number;
}

export interface IServiceHealth {
  readonly service: string;
  /** healthy, unhealthy, starting, restarting, running, or the container state (exited, created…). */
  readonly health: string;
}

export interface IPorts {
  readonly ui: number;
  readonly api: number;
  readonly postgres: number;
  readonly valkey: number;
}

export interface IStackSummary {
  readonly project: string;
  readonly slot: number;
  readonly workspace: string | null;
  readonly issue: string | null;
  readonly branch: string | null;
  /** What the stack's agent says it is doing; derived from the containers when it says nothing. */
  readonly plainStatus: string;
  readonly statusAt: string | null;
  readonly services: readonly IServiceHealth[];
  readonly running: number;
  readonly total: number;
  readonly unhealthy: readonly string[];
  readonly memoryMiB: number;
  readonly cpuPercent: number;
  readonly ports: IPorts;
  readonly uiUrl: string;
  readonly previewUrl: string | null;
  readonly lastVerify: IVerifyResult | null;
}

const text = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];

  return typeof value === "string" ? value : "";
};

/** Splits Docker's `a=b,c=d` label list (values may hold `=`). */
export const parseLabels = (labels: string): Record<string, string> =>
  labels.split(",").reduce<Record<string, string>>((found, pair) => {
    const equals = pair.indexOf("=");
    const key = equals < 0 ? "" : pair.slice(0, equals);

    return key === "" ? found : { ...found, [key]: pair.slice(equals + 1) };
  }, {});

/** JSON lines from a command's output, parsed; lines that are not JSON objects are dropped. */
export const jsonLines = (output: string): Record<string, unknown>[] =>
  output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .flatMap((line): Record<string, unknown>[] => {
      try {
        const value: unknown = JSON.parse(line);

        return isRecord(value) ? [value] : [];
      } catch {
        return [];
      }
    });

/** Lines of `docker ps --format json`, kept when they belong to a compose project. */
export const parseContainers = (output: string): IContainer[] =>
  jsonLines(output)
    .map((record) => {
      const labels = parseLabels(text(record, "Labels"));

      return {
        name: text(record, "Names"),
        project: labels[COMPOSE_PROJECT_LABEL] ?? "",
        service: labels[COMPOSE_SERVICE_LABEL] ?? "",
        workingDir: labels[COMPOSE_WORKDIR_LABEL] ?? "",
        state: text(record, "State"),
        status: text(record, "Status"),
        ports: text(record, "Ports"),
      };
    })
    .filter((container) => container.project !== "");

const UNITS: Readonly<Record<string, number>> = {
  B: 1 / 2 ** 20,
  KiB: 1 / 1024,
  KB: 1 / 1024,
  MiB: 1,
  MB: 1,
  GiB: 1024,
  GB: 1024,
};

/** "319.7MiB / 768MiB" → 319.7 (the used part, in MiB). */
export const usedMiB = (memUsage: string): number => {
  const match = /^([\d.]+)\s*([A-Za-z]+)/u.exec(memUsage.trim());
  const unit = match?.[2];
  const factor = unit === undefined ? undefined : UNITS[unit];

  return match?.[1] === undefined || factor === undefined
    ? 0
    : Number(match[1]) * factor;
};

/** "12.5%" → 12.5; a value that does not read counts as 0. */
export const cpuOf = (percent: string): number => {
  const value = Number.parseFloat(percent);

  return Number.isNaN(value) ? 0 : value;
};

/** Lines of `docker stats --no-stream --format json`. */
export const parseStats = (output: string): IStat[] =>
  jsonLines(output).map((record) => ({
    name: text(record, "Name"),
    memoryMiB: usedMiB(text(record, "MemUsage")),
    cpuPercent: cpuOf(text(record, "CPUPerc")),
  }));

/** A container's health in one word: from its health check when it has one. */
export const healthOf = (container: IContainer): string => {
  if (container.state === "restarting") {
    return "restarting";
  }

  if (container.status.includes("(unhealthy)")) {
    return "unhealthy";
  }

  if (container.status.includes("(health: starting)")) {
    return "starting";
  }

  if (container.status.includes("(healthy)")) {
    return "healthy";
  }

  return container.state === "running" ? "running" : container.state;
};

/** The port each service of slot N publishes on the host: base + N (README "Slots"). */
export const portsOf = (
  slot: number,
  bases: typeof FACTORY_CONFIG.portBases = FACTORY_CONFIG.portBases
): IPorts => ({
  ui: bases.ui + slot,
  api: bases.api + slot,
  postgres: bases.postgres + slot,
  valkey: bases.valkey + slot,
});

/**
 * The plain line a person reads for a stack: the agent's own status when it
 * wrote one, else what the containers show.
 */
export const derivedStatus = (
  services: readonly IServiceHealth[],
  unhealthy: readonly string[]
): string => {
  const running = services.filter((service) =>
    ["healthy", "running", "starting"].includes(service.health)
  ).length;

  if (services.length === 0) {
    return "No services are running.";
  }

  if (unhealthy.length > 0) {
    return `Needs attention: ${unhealthy.join(", ")} not healthy.`;
  }

  if (running < services.length) {
    return `Partly stopped: ${String(running)} of ${String(services.length)} services running.`;
  }

  return `Running: all ${String(services.length)} services up.`;
};

export interface ISummaryInput {
  readonly slot: number;
  readonly containers: readonly IContainer[];
  readonly stats: readonly IStat[];
  readonly claim: ISlotClaim | null;
  readonly status: IStatusLine | null;
  readonly previewUrl: string | null;
  readonly lastVerify: IVerifyResult | null;
  readonly prefix?: string;
  readonly bases?: typeof FACTORY_CONFIG.portBases;
}

/** One stack's line in the fleet: its claim, what it says it does, health, size and URLs. */
export const summarizeStack = (input: ISummaryInput): IStackSummary => {
  const project = projectOfSlot(
    input.prefix ?? FACTORY_CONFIG.project,
    input.slot
  );
  const names = new Set(input.containers.map((container) => container.name));
  const services: IServiceHealth[] = input.containers
    .map((container) => ({
      service: container.service,
      health: healthOf(container),
    }))
    .sort((left, right) => left.service.localeCompare(right.service));
  const unhealthy = services
    .filter((service) => ["unhealthy", "restarting"].includes(service.health))
    .map((service) => service.service);
  const ports = portsOf(input.slot, input.bases);
  const own = input.stats.filter((stat) => names.has(stat.name));

  return {
    project,
    slot: input.slot,
    workspace: input.claim?.workspace ?? null,
    issue: input.claim?.issue ?? null,
    branch: input.claim?.branch ?? null,
    plainStatus: input.status?.text ?? derivedStatus(services, unhealthy),
    statusAt: input.status?.at ?? null,
    services,
    running: services.filter((service) =>
      ["healthy", "running", "starting"].includes(service.health)
    ).length,
    total: services.length,
    unhealthy,
    memoryMiB: own.reduce((total, stat) => total + stat.memoryMiB, 0),
    cpuPercent: own.reduce((total, stat) => total + stat.cpuPercent, 0),
    ports,
    uiUrl: `http://127.0.0.1:${String(ports.ui)}`,
    previewUrl: input.previewUrl,
    lastVerify: input.lastVerify,
  };
};
