/*
 * Pure parts of `factory logs` and `factory findings`: reading Docker's
 * timestamped lines, the API's JSON log records (pino, with the level as an
 * upper-case label and `event`/`requestId` fields), filters, and grouping of
 * errors by message shape. Nothing here touches Docker or the disk.
 */
import { isRecord } from "../state";

export const LEVELS = ["debug", "info", "warn", "error"] as const;

export type Level = (typeof LEVELS)[number];

const RANK: Readonly<Record<Level, number>> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface ILogRecord {
  /** ISO time from Docker's own timestamp on the line. */
  readonly time: string;
  readonly service: string;
  readonly level: Level;
  readonly message: string;
  /** The API's `event` field (a logger event name), when the line has one. */
  readonly event: string | null;
  readonly requestId: string | null;
}

/** Every spelling of a level the services use, mapped to one of LEVELS. */
export const levelOf = (raw: string): Level | null => {
  const word = raw.trim().toLowerCase();

  if (["trace", "debug", "10", "20"].includes(word)) {
    return "debug";
  }

  if (["info", "information", "notice", "30"].includes(word)) {
    return "info";
  }

  if (["warn", "warning", "40"].includes(word)) {
    return "warn";
  }

  if (
    ["error", "err", "fatal", "critical", "panic", "50", "60"].includes(word)
  ) {
    return "error";
  }

  return null;
};

/** Docker's `--timestamps` prefix (`2026-11-23T10:00:00.123Z text`), split off. */
export const splitTimestamp = (
  line: string
): { time: string; text: string } | null => {
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) ?(.*)$/u.exec(line);

  return match?.[1] === undefined
    ? null
    : { time: match[1], text: match[2] ?? "" };
};

/** Milliseconds for a Docker time, whatever its fraction's digit count. */
export const millisOf = (time: string): number => {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z$/u.exec(
    time
  );

  return match?.[1] === undefined
    ? Number.NaN
    : Date.parse(`${match[1]}.${(match[2] ?? "").padEnd(3, "0").slice(0, 3)}Z`);
};

const levelFromWords = (text: string): Level => {
  if (/\b(error|exception|traceback|panic|fatal|failed)\b/iu.test(text)) {
    return "error";
  }

  return /\bwarn(ing)?\b/iu.test(text) ? "warn" : "info";
};

const stringField = (
  record: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value !== "") {
      return value;
    }
  }

  return null;
};

/** One line of `docker logs --timestamps` read into a record; null for a line with no timestamp. */
export const parseLogLine = (
  line: string,
  service: string
): ILogRecord | null => {
  const stamped = splitTimestamp(line);

  if (stamped === null) {
    return null;
  }

  const base = { time: stamped.time, service };

  if (stamped.text.startsWith("{")) {
    try {
      const value: unknown = JSON.parse(stamped.text);

      if (isRecord(value)) {
        const level = levelOf(stringField(value, ["level"]) ?? "") ?? "info";

        return {
          ...base,
          level,
          message:
            stringField(value, ["msg", "message", "error"]) ?? stamped.text,
          event: stringField(value, ["event"]),
          requestId: stringField(value, ["requestId", "reqId", "request_id"]),
        };
      }
    } catch {
      // Not JSON after all: read it as plain text below.
    }
  }

  return {
    ...base,
    level: levelFromWords(stamped.text),
    message: stamped.text,
    event: null,
    requestId: null,
  };
};

/** `15m`, `2h`, `30s`, `1d` or an ISO time → the start time it means; null when neither. */
export const sinceTime = (since: string, nowMs: number): Date | null => {
  const relative = /^(\d+)([smhd])$/u.exec(since);

  if (relative?.[1] !== undefined) {
    const seconds: Readonly<Record<string, number>> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    const unit = seconds[relative[2] ?? "s"] ?? 1;

    return new Date(nowMs - Number(relative[1]) * unit * 1000);
  }

  const absolute = new Date(since);

  return Number.isNaN(absolute.getTime()) ? null : absolute;
};

/** Records are shown in time order. */
export const byTime = (records: readonly ILogRecord[]): ILogRecord[] =>
  [...records].sort(
    (left, right) => millisOf(left.time) - millisOf(right.time)
  );

/** A health probe every few seconds per service is never what anyone is looking for. */
export const isHealthProbe = (record: ILogRecord): boolean =>
  /\b(GET|HEAD) \S*\/(health|healthz|ready|live)\b/u.test(record.message);

export interface ILogFilter {
  readonly minLevel: Level;
  readonly requestId: string | null;
}

export const matchesFilter = (
  record: ILogRecord,
  filter: ILogFilter
): boolean =>
  RANK[record.level] >= RANK[filter.minLevel] &&
  (filter.requestId === null ||
    record.requestId === filter.requestId ||
    record.message.includes(filter.requestId));

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu;

/** Emails and quoted values out: a log line can hold a customer's name or address. */
export const scrubMessage = (message: string): string =>
  message.replace(EMAIL, "<email>").replace(/"[^"]*"|'[^']*'/gu, "<str>");

/** A message with its ids, numbers and quoted values blanked: alike errors get one signature. */
export const messageSignature = (message: string): string =>
  scrubMessage(message)
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu,
      "<id>"
    )
    .replace(/\b[0-9a-f]{16,}\b/giu, "<hex>")
    .replace(/\d+(?:\.\d+)?/gu, "<n>")
    .slice(0, 200);

export interface IErrorGroup {
  readonly service: string;
  readonly signature: string;
  readonly event: string | null;
  readonly count: number;
  readonly first: string;
  readonly last: string;
  /** The first message seen, scrubbed. */
  readonly example: string;
}

export interface ILogSummary {
  readonly counts: Readonly<Record<string, Readonly<Record<Level, number>>>>;
  readonly errors: readonly IErrorGroup[];
}

const emptyCounts = (): Record<Level, number> => ({
  debug: 0,
  info: 0,
  warn: 0,
  error: 0,
});

/** Records per service and level, and errors grouped by signature, most frequent first. */
export const summarizeRecords = (
  records: readonly ILogRecord[]
): ILogSummary => {
  const counts = new Map<string, Record<Level, number>>();
  const groups = new Map<string, IErrorGroup>();

  for (const record of byTime(records)) {
    const serviceCounts = counts.get(record.service) ?? emptyCounts();

    serviceCounts[record.level] += 1;
    counts.set(record.service, serviceCounts);

    if (record.level === "error") {
      const signature = messageSignature(record.message);
      const key = `${record.service}\u0000${record.event ?? ""}\u0000${signature}`;
      const group = groups.get(key);

      groups.set(
        key,
        group === undefined
          ? {
              service: record.service,
              signature,
              event: record.event,
              count: 1,
              first: record.time,
              last: record.time,
              example: scrubMessage(record.message).slice(0, 300),
            }
          : { ...group, count: group.count + 1, last: record.time }
      );
    }
  }

  return {
    counts: Object.fromEntries(counts),
    errors: [...groups.values()].sort(
      (left, right) => right.count - left.count
    ),
  };
};
