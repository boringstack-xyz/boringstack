#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { META_RULES } from "./registry";
import { createForbiddenTextPatterns } from "./rules/source-text/forbidden-patterns";

const LINT_META_DIR = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(LINT_META_DIR, "RULES.md");
const REPO_ROOT = join(LINT_META_DIR, "../..");

export interface IRuleCatalogRow {
  readonly id: string;
  readonly category: string;
  readonly ciCritical: boolean;
  readonly description: string;
}

function guardFromMessage(message: string): string {
  const firstSentence = /^[^.!?]+[.!?]?/u.exec(message.trim())?.[0];

  return (firstSentence ?? message).trim();
}

export function buildRuleCatalog(root: string = REPO_ROOT): IRuleCatalogRow[] {
  const rows: IRuleCatalogRow[] = [];
  const registryIds = new Set<string>();

  for (const rule of META_RULES) {
    registryIds.add(rule.id);
    rows.push({
      id: rule.id,
      category: rule.category,
      ciCritical: rule.ciCritical === true,
      description: rule.description
    });

    if (rule.id === "forbidden-text") {
      for (const pattern of createForbiddenTextPatterns(root)) {
        if (registryIds.has(pattern.rule)) {
          continue;
        }

        rows.push({
          id: pattern.rule,
          category: "source-text",
          ciCritical: false,
          description: guardFromMessage(pattern.message)
        });
      }
    }

    if (
      rule.id === "github-actions-permissions" &&
      rule.runAsync !== undefined
    ) {
      rows.push({
        id: "github-actions-permissions:verify",
        category: "ci",
        ciCritical: false,
        description:
          "Pinned action SHAs resolve on github.com (lint:meta:verify only)."
      });
    }
  }

  return rows;
}

function formatAlignedMarkdownTable(
  headers: readonly string[],
  bodyRows: readonly (readonly string[])[]
): string {
  const widths = headers.map((header, columnIndex) =>
    Math.max(
      header.length,
      3,
      ...bodyRows.map((row) => row[columnIndex]?.length ?? 0)
    )
  );

  const formatRow = (cells: readonly string[]): string =>
    `| ${cells.map((cell, columnIndex) => cell.padEnd(widths[columnIndex] ?? cell.length)).join(" | ")} |`;

  const separator = `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`;

  return [formatRow(headers), separator, ...bodyRows.map(formatRow)].join("\n");
}

function formatRulesTable(rows: IRuleCatalogRow[]): string {
  return formatAlignedMarkdownTable(
    ["Rule ID", "Category", "CI-critical", "What it guards"],
    rows.map((row) => [
      `\`${row.id}\``,
      row.category,
      row.ciCritical ? "**yes**" : "no",
      row.description
    ])
  );
}

export function renderRulesMd(root: string = REPO_ROOT): string {
  const rows = buildRuleCatalog(root);

  return `# lint:meta rule catalog

Run \`bun run lint:meta --list-rules\` for the machine-readable list from the registry.

## Adding a rule

1. Pick a category folder under \`scripts/lint-meta/rules/\`.
2. Export an \`IMetaRule\` object with \`id\`, \`category\`, \`description\`, and \`run(ctx)\`.
3. Register it in \`scripts/lint-meta/registry.ts\`.
4. Run \`bun run generate:lint-meta-docs\` to refresh this file.
5. Add a test in \`tests/lint-meta/\` (fixture or temp dir — never commit invalid imports that break \`tsc\`).

## Rules

${formatRulesTable(rows)}

## CI-critical rules

Rules marked CI-critical protect contracts that TypeScript alone can miss. Always run \`bun run check\` before pushing apps/ui.
`;
}

export function main(checkMode = process.argv.includes("--check")): void {
  const content = renderRulesMd();

  if (checkMode) {
    const current = readFileSync(RULES_PATH, "utf8");

    if (current !== content) {
      console.error(
        "[generate:lint-meta-docs] RULES.md is out of date — run bun run generate:lint-meta-docs"
      );
      process.exit(1);
    }

    console.log("[generate:lint-meta-docs] RULES.md is up to date.");

    return;
  }

  writeFileSync(RULES_PATH, content, "utf8");
  console.log(`[generate:lint-meta-docs] wrote ${RULES_PATH}`);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
