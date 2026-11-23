/*
 * Pure parts of `factory findings`: error records grouped into findings,
 * muted by the reasoned list in tools/factory/expected-log-findings.json, and
 * merged into the machine's ledger (<shared>/findings.json). A finding carries
 * its message's signature, never the message: an issue can hold a customer's
 * name or address, so quoted values and emails are blanked first.
 */
import { createHash } from "node:crypto";

import { escapeRegExp } from "./slots.utils";
import { isRecord } from "../state";
import { type ILogRecord, messageSignature, scrubMessage } from "./logs.utils";

/** A message the stack logs on purpose, muted, with the reason why. */
export interface IExpectedRule {
  /** Service name, `*` wildcards allowed (`dreamdata-*`). */
  readonly service: string;
  /** A regular expression matched, case-insensitively, against the whole message. */
  readonly match: string;
  readonly reason: string;
}

export const EXPECTED_FILE_VERSION = 1;

/** Shape of tools/factory/expected-log-findings.json. */
export interface IExpectedFile {
  readonly version: typeof EXPECTED_FILE_VERSION;
  readonly description: string;
  readonly rules: readonly IExpectedRule[];
}

export interface ICompiledRule {
  readonly service: RegExp;
  readonly match: RegExp;
}

export interface IFinding {
  /** Stable across scans: service and signature. */
  readonly id: string;
  readonly service: string;
  readonly event: string | null;
  readonly signature: string;
  readonly count: number;
  readonly firstSeen: string;
  readonly lastSeen: string;
  /** The first message seen, with emails and quoted values blanked. */
  readonly example: string;
  /** True when an expected-findings rule mutes it. */
  readonly muted: boolean;
  /** The issue it was filed as, or null. */
  readonly filed: { readonly url: string } | null;
}

export interface ILedger {
  readonly version: typeof EXPECTED_FILE_VERSION;
  readonly findings: readonly IFinding[];
}

export const EMPTY_LEDGER: ILedger = {
  version: EXPECTED_FILE_VERSION,
  findings: [],
};

/** Reads the expected-findings file; throws naming what is wrong with it. */
export const parseExpectedFile = (body: unknown): IExpectedRule[] => {
  if (!isRecord(body) || body.version !== EXPECTED_FILE_VERSION) {
    throw new Error(
      `expected-log-findings.json must have "version": ${String(EXPECTED_FILE_VERSION)}`
    );
  }

  if (!Array.isArray(body.rules)) {
    throw new Error('expected-log-findings.json must have a "rules" array');
  }

  return body.rules.map((rule: unknown, index) => {
    if (
      !isRecord(rule) ||
      typeof rule.service !== "string" ||
      typeof rule.match !== "string" ||
      typeof rule.reason !== "string" ||
      rule.reason.trim() === ""
    ) {
      throw new Error(
        `rule ${String(index)} needs a service, a match and a reason`
      );
    }

    return { service: rule.service, match: rule.match, reason: rule.reason };
  });
};

/** `dreamdata-*` → a regular expression matching the whole name. */
export const globToRegExp = (glob: string): RegExp =>
  new RegExp(`^${glob.split("*").map(escapeRegExp).join(".*")}$`, "u");

/** The rules with their patterns compiled. Throws, naming the rule, when a pattern is invalid. */
export const compileRules = (
  rules: readonly IExpectedRule[]
): ICompiledRule[] =>
  rules.map((rule, index) => {
    try {
      return {
        service: globToRegExp(rule.service),
        match: new RegExp(rule.match, "iu"),
      };
    } catch (error: unknown) {
      throw new Error(
        `rule ${String(index)} (${rule.service}): its match is not a valid regular expression: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  });

export const findingIdOf = (
  service: string,
  signature: string,
  event: string | null
): string =>
  createHash("sha256")
    .update(`${service}\u0000${event ?? ""}\u0000${signature}`)
    .digest("hex")
    .slice(0, 12);

const isMuted = (
  record: ILogRecord,
  rules: readonly ICompiledRule[]
): boolean =>
  rules.some(
    (rule) =>
      rule.service.test(record.service) && rule.match.test(record.message)
  );

/** Error records of one scan, one finding per service, event and signature. */
export const scanFindings = (
  records: readonly ILogRecord[],
  rules: readonly ICompiledRule[]
): IFinding[] => {
  const found = new Map<string, IFinding>();

  for (const record of records) {
    if (record.level !== "error") {
      continue;
    }

    const signature = messageSignature(record.message);
    const id = findingIdOf(record.service, signature, record.event);
    const current = found.get(id);

    found.set(id, {
      id,
      service: record.service,
      event: record.event,
      signature,
      count: (current?.count ?? 0) + 1,
      firstSeen: current?.firstSeen ?? record.time,
      lastSeen: record.time,
      example: current?.example ?? scrubMessage(record.message).slice(0, 300),
      muted: current?.muted ?? isMuted(record, rules),
      filed: null,
    });
  }

  return [...found.values()];
};

/** Reads the ledger; anything that does not read is an empty ledger, not a crash. */
export const parseLedger = (body: unknown): ILedger => {
  if (!isRecord(body) || !Array.isArray(body.findings)) {
    return EMPTY_LEDGER;
  }

  return {
    version: EXPECTED_FILE_VERSION,
    findings: body.findings.filter(isFinding),
  };
};

const isFinding = (value: unknown): value is IFinding =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.service === "string" &&
  typeof value.signature === "string" &&
  typeof value.count === "number";

/**
 * The ledger after a scan: scanned findings update the ones known (counts,
 * times, mute state), new ones are added, filed issues are kept as they are.
 */
export const mergeLedger = (
  ledger: ILedger,
  scanned: readonly IFinding[]
): ILedger => {
  const known = new Map(
    ledger.findings.map((finding) => [finding.id, finding])
  );

  for (const finding of scanned) {
    const previous = known.get(finding.id);

    known.set(
      finding.id,
      previous === undefined
        ? finding
        : {
            ...previous,
            count: finding.count,
            lastSeen: finding.lastSeen,
            firstSeen:
              previous.firstSeen < finding.firstSeen
                ? previous.firstSeen
                : finding.firstSeen,
            muted: finding.muted,
          }
    );
  }

  return {
    version: EXPECTED_FILE_VERSION,
    findings: [...known.values()].sort((left, right) =>
      left.id.localeCompare(right.id)
    ),
  };
};

/** Unmuted findings without an issue yet, the most frequent first. */
export const unfiledFindings = (ledger: ILedger): IFinding[] =>
  ledger.findings
    .filter((finding) => !finding.muted && finding.filed === null)
    .sort((left, right) => right.count - left.count);
