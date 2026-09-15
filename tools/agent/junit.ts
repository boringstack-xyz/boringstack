/**
 * Joins the JUnit reports of test shards into one document. Each report is a
 * `<testsuites>` root; the suites inside keep their attributes, so evidence
 * and manifest checks read the merged file exactly as they read a single run.
 */
export function mergeJunitReports(reports: readonly string[]): string {
  const bodies: string[] = [];

  for (const report of reports) {
    const open = report.indexOf("<testsuites");
    const close = report.lastIndexOf("</testsuites>");

    if (open === -1 || close === -1) {
      return "";
    }

    const start = report.indexOf(">", open);

    if (start === -1 || start > close) {
      return "";
    }

    bodies.push(report.slice(start + 1, close));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>${bodies.join("")}</testsuites>\n`;
}

/**
 * Greedy longest-first packing of files into `count` shards by size, a
 * stand-in for duration. Deterministic for a given file list.
 */
export function shardFiles(
  files: readonly { readonly path: string; readonly size: number }[],
  count: number
): string[][] {
  const shards: { size: number; paths: string[] }[] = Array.from(
    { length: Math.max(1, count) },
    () => ({ size: 0, paths: [] })
  );
  const ordered = [...files].sort((left, right) =>
    right.size === left.size
      ? left.path.localeCompare(right.path)
      : right.size - left.size
  );

  for (const file of ordered) {
    const target = shards.reduce((best, shard) =>
      shard.size < best.size ? shard : best
    );

    target.size += file.size;
    target.paths.push(file.path);
  }

  return shards
    .map((shard) => shard.paths.sort())
    .filter((paths) => paths.length > 0);
}

/** Seconds per file from the `testsuite` elements bun writes, one per file. */
export function suiteDurations(xml: string): Record<string, number> {
  const durations: Record<string, number> = {};

  for (const match of xml.matchAll(/<testsuite\b([^>]*)>/g)) {
    const attributes = match[1] ?? "";
    const file = /\bfile="([^"]+)"/.exec(attributes)?.[1];
    const time = Number(/\btime="([^"]+)"/.exec(attributes)?.[1]);

    if (file !== undefined && Number.isFinite(time) && time >= 0) {
      durations[file] = (durations[file] ?? 0) + time;
    }
  }

  return durations;
}
