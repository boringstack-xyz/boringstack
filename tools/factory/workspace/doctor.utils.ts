/** One check the doctor ran, with the plain fix line when it failed. */
export interface ICheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
  readonly fix?: string;
}

/** Below this, a stack's images and volumes will not fit. */
export const MIN_FREE_GIB = 10;

const GIB = 1024 ** 3;

/** Parses `df -k` output: free kibibytes on the filesystem, in bytes. */
export const freeBytesFromDf = (text: string): number | undefined => {
  const line = text.trim().split("\n").at(-1) ?? "";
  const available = Number(line.trim().split(/\s+/u)[3]);

  return Number.isFinite(available) && available >= 0
    ? available * 1024
    : undefined;
};

export const freeDiskCheck = (freeBytes: number | undefined): ICheck => {
  if (freeBytes === undefined) {
    return {
      name: "free disk",
      ok: false,
      detail: "could not read free disk space",
      fix: "check that `df` works on this machine",
    };
  }

  const gib = freeBytes / GIB;
  const shown = gib.toFixed(1);

  return gib >= MIN_FREE_GIB
    ? { name: "free disk", ok: true, detail: `${shown} GiB free` }
    : {
        name: "free disk",
        ok: false,
        detail: `${shown} GiB free, ${String(MIN_FREE_GIB)} GiB needed`,
        fix: "free disk space (remove old Docker images and unused folders) and run doctor again",
      };
};

/** Parses a version such as "24.0.0" or ">=24.0.0" into numbers. */
export const parseVersion = (text: string): number[] | undefined => {
  const match = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/u.exec(text);

  return match === null
    ? undefined
    : [match[1], match[2], match[3]].map((part) => Number(part ?? 0));
};

/** -1, 0 or 1 comparing two parsed versions. */
export const compareVersions = (
  left: readonly number[],
  right: readonly number[]
): number => {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);

    if (difference !== 0) {
      return difference > 0 ? 1 : -1;
    }
  }

  return 0;
};

/**
 * The Node.js version the apps need: the highest minimum among every engines
 * range and the installed Astro's own requirement. Undefined when none parse.
 */
export const requiredNode = (ranges: readonly string[]): string | undefined => {
  const parsed = ranges
    .map(parseVersion)
    .filter((version): version is number[] => version !== undefined);
  const highest = parsed.reduce<number[] | undefined>(
    (best, version) =>
      best === undefined || compareVersions(version, best) > 0 ? version : best,
    undefined
  );

  return highest?.join(".");
};

export const nodeCheck = (
  hostVersion: string,
  required: string | undefined,
  sources: readonly string[]
): ICheck => {
  const host = parseVersion(hostVersion);
  const need = required === undefined ? undefined : parseVersion(required);

  if (host === undefined || need === undefined) {
    return {
      name: "node",
      ok: false,
      detail: `could not compare Node ${hostVersion} with the apps' requirement`,
      fix: "install Node.js (see apps/docs/package.json engines)",
    };
  }

  const needed = need.join(".");
  const detail = `Node ${hostVersion}; apps need ${needed} (${sources.join(", ")})`;

  return compareVersions(host, need) >= 0
    ? { name: "node", ok: true, detail }
    : {
        name: "node",
        ok: false,
        detail,
        fix: `install Node.js ${needed} or later (for example with nvm or fnm), then run doctor again`,
      };
};

/** Compares a bun version with the repo's exact pin. */
export const bunCheck = (
  hostBun: string,
  pinned: string | undefined
): ICheck => {
  if (pinned === undefined) {
    return {
      name: "bun",
      ok: false,
      detail: "the repo does not pin a bun version",
      fix: "check the packageManager field in package.json",
    };
  }

  return hostBun.trim() === pinned
    ? { name: "bun", ok: true, detail: `bun ${pinned}` }
    : {
        name: "bun",
        ok: false,
        detail: `bun ${hostBun.trim() === "" ? "missing" : hostBun.trim()}; the repo pins ${pinned}`,
        fix: `install bun ${pinned} (bun upgrade --version ${pinned}, or the installer) so checks match CI`,
      };
};

/** Docker compose v2 needs at least 2.24 for the `!override` tag used by the factory overlay. */
export const composeCheck = (version: string | undefined): ICheck => {
  const parsed = version === undefined ? undefined : parseVersion(version);
  const ok = parsed !== undefined && compareVersions(parsed, [2, 24, 0]) >= 0;

  return ok
    ? { name: "docker compose", ok: true, detail: `compose ${version ?? ""}` }
    : {
        name: "docker compose",
        ok: false,
        detail: `compose ${version ?? "not found"}; v2.24 or later is needed`,
        fix: "install Docker Compose v2.24 or later (the Docker Desktop or Compose plugin update)",
      };
};
