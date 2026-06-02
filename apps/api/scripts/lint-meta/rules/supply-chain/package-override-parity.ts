import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

/*
 * Security/parity `overrides` in one app's package.json must hold across the
 * monorepo: a sibling app that resolves the same package (per its bun.lock)
 * either mirrors the override or has consciously pinned the same version.
 * Two failure modes are caught:
 *
 *   1. Stale override — an app's own bun.lock resolves a different version
 *      than its declared override (the override never took effect; run
 *      `bun install`).
 *   2. Missing mirror — a sibling resolves the package at a different
 *      version than the override and declares no override of its own
 *      (e.g. a GHSA patch pinned in one app but not the others).
 */

interface IAppOverrides {
  readonly app: string;
  readonly file: string;
  readonly overrides: Record<string, string>;
  readonly lockfileText: string | null;
}

function toStringRecord(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const out: Record<string, string> = {};

  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") {
      out[k] = v;
    }
  }

  return out;
}

function readApps(appsDir: string): IAppOverrides[] {
  const out: IAppOverrides[] = [];
  let entries: string[];

  try {
    entries = readdirSync(appsDir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    const dir = join(appsDir, entry);

    let isDir: boolean;

    try {
      isDir = statSync(dir).isDirectory();
    } catch {
      continue;
    }

    if (!isDir) {
      continue;
    }

    const file = join(dir, "package.json");
    let parsed: unknown;

    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      continue;
    }

    if (typeof parsed !== "object" || parsed === null) {
      continue;
    }

    let overridesValue: unknown;

    for (const [k, v] of Object.entries(parsed)) {
      if (k === "overrides") {
        overridesValue = v;
      }
    }

    let lockfileText: string | null;

    try {
      lockfileText = readFileSync(join(dir, "bun.lock"), "utf8");
    } catch {
      lockfileText = null;
    }

    out.push({
      app: entry,
      file,
      overrides: toStringRecord(overridesValue),
      lockfileText,
    });
  }

  return out;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** Versions the lockfile resolves for `name` (entries look like "name@1.2.3"). */
function resolvedVersions(lockfileText: string, name: string): string[] {
  const regex = new RegExp(`"${escapeRegExp(name)}@(\\d[^"]*)"`, "gu");
  const versions = new Set<string>();
  let match: RegExpExecArray | null = regex.exec(lockfileText);

  while (match !== null) {
    const version = match[1];

    if (version !== undefined) {
      versions.add(version);
    }

    match = regex.exec(lockfileText);
  }

  return [...versions];
}

type Reporter = (file: string, key: string, message: string) => void;

function checkStaleOverrides(app: IAppOverrides, report: Reporter): void {
  if (app.lockfileText === null) {
    return;
  }

  for (const [name, version] of Object.entries(app.overrides)) {
    const resolved = resolvedVersions(app.lockfileText, name);

    if (resolved.length > 0 && resolved.join(",") !== version) {
      report(
        app.file,
        `stale:${name}`,
        `Override ${name}@${version} is not what bun.lock resolves (${resolved.join(", ")}) — run \`bun install\` to apply it.`
      );
    }
  }
}

function checkSiblingMirror(
  owner: IAppOverrides,
  sibling: IAppOverrides,
  name: string,
  version: string,
  report: Reporter
): void {
  if (sibling.lockfileText === null) {
    return;
  }

  const siblingOverride = sibling.overrides[name];

  if (siblingOverride !== undefined) {
    if (siblingOverride !== version) {
      report(
        sibling.file,
        `drift:${name}`,
        `Override ${name}@${siblingOverride} drifts from ${owner.app}'s ${name}@${version} — align the pins or document why they differ.`
      );
    }

    return;
  }

  const resolved = resolvedVersions(sibling.lockfileText, name);

  if (resolved.length > 0 && resolved.join(",") !== version) {
    report(
      sibling.file,
      `missing:${name}`,
      `${owner.app} overrides ${name}@${version} but this app resolves ${resolved.join(", ")} with no override — mirror the pin (it usually exists for a security advisory).`
    );
  }
}

export function checkPackageOverrideParity(appsDir: string): IViolation[] {
  const violations: IViolation[] = [];
  const reported = new Set<string>();
  const apps = readApps(appsDir);

  const report: Reporter = (file, key, message) => {
    if (reported.has(`${file}:${key}`)) {
      return;
    }

    reported.add(`${file}:${key}`);
    violations.push({ file, rule: "package-override-parity", message });
  };

  for (const app of apps) {
    checkStaleOverrides(app, report);
  }

  for (const owner of apps) {
    for (const [name, version] of Object.entries(owner.overrides)) {
      for (const sibling of apps) {
        if (sibling.app !== owner.app) {
          checkSiblingMirror(owner, sibling, name, version, report);
        }
      }
    }
  }

  return violations;
}

/** Package overrides must be applied and mirrored across sibling apps. */
export const packageOverrideParityRule: IMetaRule = {
  id: "package-override-parity",
  category: "supply-chain",
  description:
    "package.json overrides must be reflected in the app's own bun.lock and mirrored by sibling apps that resolve the same package.",
  run({ root }) {
    return checkPackageOverrideParity(join(root, ".."));
  },
};
