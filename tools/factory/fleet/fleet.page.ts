/*
 * The fleet page: a self-refreshing HTML table of every factory stack. Every
 * value goes through escapeHtml, because the status lines and issue titles
 * are written by agents. This version has no buttons that change anything.
 */
import { EMPTY_FLEET, healthText, verifyText } from "./fleet.format";
import type { IStackSummary } from "./fleet.utils";

export const REFRESH_SECONDS = 10;

const ENTITIES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/gu, (character) => ENTITIES[character] ?? character);

const STYLE = `
:root { color-scheme: light dark; --bg: #f7f7f5; --fg: #1d1d1b; --muted: #6b6b66; --line: #d9d9d3; --bad: #b42318; --good: #067647; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #151515; --fg: #efefec; --muted: #9a9a94; --line: #34342f; --bad: #f97066; --good: #75e0a7; } }
:root[data-theme="dark"] { --bg: #151515; --fg: #efefec; --muted: #9a9a94; --line: #34342f; --bad: #f97066; --good: #75e0a7; }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font: 14px/1.4 system-ui, sans-serif; }
h1 { font-size: 18px; margin: 0 0 4px; }
p.meta { color: var(--muted); margin: 0 0 16px; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 600; }
.bad { color: var(--bad); }
.good { color: var(--good); }
.wrap { overflow-x: auto; }
`;

const row = (stack: IStackSummary): string => {
  const url = stack.previewUrl ?? stack.uiUrl;
  const healthy = stack.unhealthy.length === 0 && stack.running === stack.total;
  const verifyClass =
    stack.lastVerify === null ? "" : stack.lastVerify.ok ? " good" : " bad";

  return `<tr>
  <td>${String(stack.slot)}</td>
  <td>${escapeHtml(stack.issue ?? "-")}</td>
  <td>${escapeHtml(stack.plainStatus)}</td>
  <td class="${healthy ? "good" : "bad"}">${escapeHtml(healthText(stack))}</td>
  <td>${escapeHtml(`${Math.round(stack.memoryMiB).toString()} MiB`)} · ${escapeHtml(`${stack.cpuPercent.toFixed(1)}%`)}</td>
  <td><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></td>
  <td class="${verifyClass.trim()}">${escapeHtml(verifyText(stack))}</td>
</tr>`;
};

/** The whole page. `generatedAt` is an ISO time; `dockerAvailable` false says the fleet is unknown. */
export const renderFleetPage = (input: {
  readonly stacks: readonly IStackSummary[];
  readonly generatedAt: string;
  readonly dockerAvailable: boolean;
}): string => {
  const body = !input.dockerAvailable
    ? `<p class="bad">Docker cannot be reached from this machine, so the fleet is unknown.</p>`
    : input.stacks.length === 0
      ? `<p>${escapeHtml(EMPTY_FLEET)}</p>`
      : `<div class="wrap"><table>
<thead><tr><th>Slot</th><th>Issue</th><th>Status</th><th>Health</th><th>Memory · CPU</th><th>Address</th><th>Verify</th></tr></thead>
<tbody>
${input.stacks.map(row).join("\n")}
</tbody>
</table></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="${String(REFRESH_SECONDS)}">
<title>Factory fleet</title>
<style>${STYLE}</style>
</head>
<body>
<h1>Factory fleet</h1>
<p class="meta">Updated ${escapeHtml(input.generatedAt)}. Refreshes every ${String(REFRESH_SECONDS)} seconds.</p>
${body}
</body>
</html>
`;
};
