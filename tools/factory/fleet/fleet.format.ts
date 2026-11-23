/** Plain-text rendering of the fleet for people: one line per stack, aligned. */
import type { IStackSummary } from "./fleet.utils";

export const EMPTY_FLEET = "No factory stacks are running on this machine.";

/** `3/5 up`, plus what is not healthy. */
export const healthText = (stack: IStackSummary): string => {
  const base = `${String(stack.running)}/${String(stack.total)} up`;

  return stack.unhealthy.length === 0
    ? base
    : `${base}, ${stack.unhealthy.join(" ")} unhealthy`;
};

/** The verify result as a word: `pass 20261123-101500`, `fail …`, or `never`. */
export const verifyText = (stack: IStackSummary): string => {
  const verify = stack.lastVerify;

  if (verify === null) {
    return "never";
  }

  return `${verify.ok ? "pass" : "fail"}${verify.runId === null ? "" : ` ${verify.runId}`}`;
};

const cell = (value: string, width: number): string => value.padEnd(width);

/** A table with one row per stack, columns aligned to their widest cell. */
export const renderTable = (stacks: readonly IStackSummary[]): string => {
  if (stacks.length === 0) {
    return EMPTY_FLEET;
  }

  const header = [
    "SLOT",
    "ISSUE",
    "STATUS",
    "HEALTH",
    "MEM",
    "CPU",
    "URL",
    "VERIFY",
  ];
  const rows = stacks.map((stack) => [
    String(stack.slot),
    stack.issue ?? "-",
    stack.plainStatus,
    healthText(stack),
    `${Math.round(stack.memoryMiB).toString()} MiB`,
    `${stack.cpuPercent.toFixed(1)}%`,
    stack.previewUrl ?? stack.uiUrl,
    verifyText(stack),
  ]);
  const widths = header.map((title, index) =>
    Math.max(title.length, ...rows.map((row) => (row[index] ?? "").length))
  );
  const line = (cells: readonly string[]): string =>
    cells
      .map((value, index) => cell(value, widths[index] ?? 0))
      .join("  ")
      .trimEnd();

  return [line(header), ...rows.map(line)].join("\n");
};
