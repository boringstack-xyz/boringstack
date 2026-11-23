/*
 * Pure readers for the machine-wide slot files (README "Slots" and "Where
 * things live"): `<shared>/slots/s<N>.json` (claims), `<shared>/status/s<N>.json`
 * (what a stack is doing) and `<shared>/preview/s<N>.json` (preview address).
 * The workspace agent writes them; these read them tolerantly, so a missing or
 * half-written field reads as absent rather than failing the fleet page.
 */
import { isRecord } from "../state";

export interface ISlotClaim {
  readonly slot: number;
  /** The workspace folder that holds the slot's worktree. */
  readonly workspace: string;
  readonly issue: string | null;
  readonly branch: string | null;
  readonly claimedAt: string | null;
}

export interface IStatusLine {
  /** Plain words, written for people who do not read code. */
  readonly text: string;
  readonly at: string | null;
}

export interface IVerifyResult {
  readonly ok: boolean;
  readonly level: string | null;
  readonly runId: string | null;
  readonly at: string | null;
}

export const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const textOf = (
  record: Record<string, unknown>,
  key: string
): string | null => {
  const value = record[key];

  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
};

/** The slot number a compose project name carries: `<prefix>-s3` → 3. */
export const slotOfProject = (
  project: string,
  prefix: string
): number | null => {
  const match = new RegExp(`^${escapeRegExp(prefix)}-s(\\d+)$`, "u").exec(
    project
  );

  return match?.[1] === undefined ? null : Number(match[1]);
};

export const projectOfSlot = (prefix: string, slot: number): string =>
  `${prefix}-s${String(slot)}`;

/** `s3.json` → 3; any other file name → null. */
export const slotOfFileName = (fileName: string): number | null => {
  const match = /^s(\d+)\.json$/u.exec(fileName);

  return match?.[1] === undefined ? null : Number(match[1]);
};

export const parseClaim = (slot: number, body: unknown): ISlotClaim | null => {
  if (!isRecord(body)) {
    return null;
  }

  const workspace = textOf(body, "workspace");

  return workspace === null
    ? null
    : {
        slot,
        workspace,
        issue: textOf(body, "issue"),
        branch: textOf(body, "branch"),
        claimedAt: textOf(body, "claimedAt"),
      };
};

export const parseStatusLine = (body: unknown): IStatusLine | null => {
  if (!isRecord(body)) {
    return null;
  }

  const text = textOf(body, "text");

  return text === null ? null : { text, at: textOf(body, "at") };
};

/** The address a slot's preview is published at, when preview is on. */
export const parsePreviewUrl = (body: unknown): string | null =>
  isRecord(body) ? textOf(body, "url") : null;

/** A stack's `verify/latest.json`, read down to what the fleet shows. */
export const parseVerify = (body: unknown): IVerifyResult | null => {
  if (!isRecord(body) || typeof body.ok !== "boolean") {
    return null;
  }

  return {
    ok: body.ok,
    level: textOf(body, "level"),
    runId: textOf(body, "runId"),
    at: textOf(body, "at"),
  };
};
