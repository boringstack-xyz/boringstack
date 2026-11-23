/*
 * `factory logs`: the API's (and every other service's) logs for this
 * workspace's stack, in one time-ordered list, or grouped into error
 * signatures with --summary. Reads Docker's own logs; runs nothing.
 */
import { parseArgs } from "node:util";

import { nowMs } from "../clock";
import type { IFactoryContext } from "../context";
import { blocked, failed, ok, type ICommandOutcome } from "../result";
import { listStackContainers, type IStackContainer } from "./docker";
import { readClaims } from "./fleet.data";
import { readRecords } from "./logs.read";
import {
  isHealthProbe,
  LEVELS,
  type ILogRecord,
  type Level,
  matchesFilter,
  sinceTime,
  summarizeRecords,
} from "./logs.utils";
import { type ProcessRunner, runProcess } from "./process";

/** How many records a plain listing shows: the newest. */
export const TAIL = 200;

export interface ILogsArgs {
  readonly errors: boolean;
  readonly since: string;
  readonly request: string | null;
  readonly summary: boolean;
  readonly slot: number | null;
}

/** The flags `factory logs` takes; a message naming the bad one when they do not read. */
export const parseLogsArgs = (args: readonly string[]): ILogsArgs | string => {
  try {
    const { values } = parseArgs({
      args: [...args],
      strict: true,
      allowPositionals: false,
      options: {
        errors: { type: "boolean", default: false },
        since: { type: "string", default: "15m" },
        request: { type: "string" },
        summary: { type: "boolean", default: false },
        slot: { type: "string" },
      },
    });
    const slot = values.slot === undefined ? null : Number(values.slot);

    if (slot !== null && (!Number.isInteger(slot) || slot < 1)) {
      return "--slot takes a stack number, 1 or more";
    }

    return {
      errors: values.errors,
      since: values.since,
      request: values.request ?? null,
      summary: values.summary,
      slot,
    };
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
};

/** The slot whose claim names this checkout, or null when this workspace has none. */
export const slotOfWorkspace = (context: IFactoryContext): number | null => {
  for (const [slot, claim] of readClaims(context.sharedDir)) {
    if (claim.workspace === context.root) {
      return slot;
    }
  }

  return null;
};

const clock = (time: string): string => time.slice(11, 23);

const format = (record: ILogRecord, width: number): string => {
  const request = record.requestId === null ? "" : `  [${record.requestId}]`;
  const event = record.event === null ? "" : `  (${record.event})`;

  return `${clock(record.time)} ${record.service.padEnd(width)} ${record.level.toUpperCase().padEnd(5)} ${record.message}${event}${request}`;
};

export const renderSummary = (
  records: readonly ILogRecord[],
  label: string
): string => {
  const summary = summarizeRecords(records);
  const services = Object.keys(summary.counts).sort();
  const width = Math.max(7, ...services.map((service) => service.length));
  const lines = [
    `${label}: ${String(records.length)} record(s)`,
    "",
    `${"service".padEnd(width)}  ${"error".padStart(6)} ${"warn".padStart(6)} ${"info+".padStart(7)}`,
    ...services.map((service) => {
      const counts = summary.counts[service] ?? {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
      };

      return `${service.padEnd(width)}  ${String(counts.error).padStart(6)} ${String(counts.warn).padStart(6)} ${String(counts.info + counts.debug).padStart(7)}`;
    }),
  ];

  if (summary.errors.length > 0) {
    lines.push("", "Errors, grouped by message (most frequent first):");

    for (const group of summary.errors.slice(0, 20)) {
      const event = group.event === null ? "" : ` (${group.event})`;

      lines.push(
        `  ${String(group.count).padStart(5)}x ${group.service}${event}: ${group.example.slice(0, 160)}`,
        `         ${clock(group.first)} to ${clock(group.last)}`
      );
    }
  }

  return lines.join("\n");
};

/** The containers a slot's logs come from; null when Docker cannot be asked. */
const containersOfSlot = (
  run: ProcessRunner,
  context: IFactoryContext,
  slot: number
): IStackContainer[] | null => {
  const containers = listStackContainers(run, context.config.project);

  return containers === null
    ? null
    : containers.filter((container) => container.slot === slot);
};

export const logsCommand = (
  args: readonly string[],
  context: IFactoryContext,
  run: ProcessRunner = runProcess,
  now: () => number = nowMs
): ICommandOutcome => {
  const parsed = parseLogsArgs(args);

  if (typeof parsed === "string") {
    return failed(parsed);
  }

  const since = sinceTime(parsed.since, now());

  if (since === null) {
    return failed(`--since: not a time: ${parsed.since}`);
  }

  const slot = parsed.slot ?? slotOfWorkspace(context);

  if (slot === null) {
    return blocked(
      "This workspace has no stack, so there are no logs to read. Pass --slot <N> to read a stack's logs."
    );
  }

  const containers = containersOfSlot(run, context, slot);

  if (containers === null) {
    return blocked("Docker cannot be reached, so the logs cannot be read.");
  }

  if (containers.length === 0) {
    return blocked(`Stack ${String(slot)} has no containers. Start it first.`, {
      slot,
    });
  }

  const minLevel: Level = parsed.errors ? "error" : LEVELS[0];
  const found = readRecords(run, containers, since).filter(
    (record) =>
      matchesFilter(record, { minLevel, requestId: parsed.request }) &&
      !isHealthProbe(record)
  );
  const project = `${context.config.project}-s${String(slot)}`;

  if (parsed.summary) {
    return ok(renderSummary(found, project), {
      slot,
      since: since.toISOString(),
      summary: summarizeRecords(found),
    });
  }

  const shown = found.slice(-TAIL);
  const width = Math.max(
    ...containers.map((container) => container.service.length)
  );
  const hidden = found.length - shown.length;
  const text = shown.map((record) => format(record, width)).join("\n");

  return ok(
    hidden > 0
      ? `${String(hidden)} older record(s) not shown.\n${text}`
      : text === ""
        ? "No matching log records."
        : text,
    { slot, since: since.toISOString(), records: shown }
  );
};
