import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";

test("the installed translation rule accepts counted plurals without hiding missing keys", () => {
  const root = mkdtempSync(join(tmpdir(), "i18n-rule-"));
  const plugin = pathToFileURL(
    join(
      process.cwd(),
      "node_modules/@boring-stack-pkg/eslint-plugin-i18n-keys/dist/index.js"
    )
  ).href;

  try {
    writeFileSync(
      join(root, "dictionary.json"),
      JSON.stringify({
        files_one: "One file",
        files_other: "Files",
        rank_ordinal_other: "Rank"
      })
    );
    writeFileSync(
      join(root, "eslint.config.mjs"),
      `import plugin from ${JSON.stringify(plugin)};
export default [{ plugins: { i18n: plugin }, rules: {
"i18n/static-translation-key-exists": ["error", {dictionary: "dictionary.json"}]
} }];`
    );
    writeFileSync(
      join(root, "case.js"),
      [
        't("files", {count: 2});',
        'i18n.t("files", {"count": 1});',
        't("rank", {count: 2, ordinal: true});',
        't("files");',
        't("missing", {count: 2});',
        't("rank", {count: 2});'
      ].join("\n")
    );
    const result = spawnSync(
      process.execPath,
      [
        join(process.cwd(), "node_modules/eslint/bin/eslint.js"),
        "--no-config-lookup",
        "--config",
        "eslint.config.mjs",
        "--format",
        "json",
        "case.js"
      ],
      { cwd: root, encoding: "utf8", timeout: 10_000 }
    );

    expect(result.status).toBe(1);
    const report: unknown = JSON.parse(result.stdout);

    expect(report).toMatchObject([
      {
        errorCount: 3,
        warningCount: 0,
        messages: [{ line: 4 }, { line: 5 }, { line: 6 }]
      }
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
