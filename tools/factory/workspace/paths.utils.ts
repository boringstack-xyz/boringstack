import { FACTORY_CONFIG } from "../factory.config";

/** Host ports a slot publishes, all on 127.0.0.1: portBases + slot. */
export interface ISlotPorts {
  readonly ui: number;
  readonly api: number;
  readonly postgres: number;
  readonly valkey: number;
}

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

export const isSlot = (slot: number): boolean =>
  Number.isInteger(slot) && slot >= 1 && slot <= FACTORY_CONFIG.maxSlots;

/** Compose project of a slot's stack: `<project>-s<N>`. */
export const stackProject = (slot: number): string =>
  `${FACTORY_CONFIG.project}-s${String(slot)}`;

/** The slot a compose project belongs to; undefined for any other project. */
export const slotOfProject = (project: string): number | undefined => {
  const match = new RegExp(
    `^${escapeRegExp(FACTORY_CONFIG.project)}-s([1-9][0-9]*)$`,
    "u"
  ).exec(project);
  const slot = Number(match?.[1]);

  return match !== null && isSlot(slot) ? slot : undefined;
};

export const slotPorts = (slot: number): ISlotPorts => ({
  ui: FACTORY_CONFIG.portBases.ui + slot,
  api: FACTORY_CONFIG.portBases.api + slot,
  postgres: FACTORY_CONFIG.portBases.postgres + slot,
  valkey: FACTORY_CONFIG.portBases.valkey + slot,
});

/** Issue ids become folder and branch names: letters, digits, `.`, `_`, `-`. */
export const isSafeIssueId = (issue: string): boolean =>
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(issue);

/** Branch a workspace is built on: `factory/<issue>`. */
export const branchFor = (issue: string): string => `factory/${issue}`;

/** Host a slot's preview answers on: `s<N>.<domain>` (the domain is PREVIEW_DOMAIN or the default). */
export const previewHostOf = (slot: number, domain: string): string =>
  `s${String(slot)}.${domain}`;

/** `s<N>.json` file name to slot number; undefined for anything else. */
export const slotOfFileName = (fileName: string): number | undefined => {
  const match = /^s([1-9][0-9]*)\.json$/u.exec(fileName);
  const slot = Number(match?.[1]);

  return match !== null && isSlot(slot) ? slot : undefined;
};
