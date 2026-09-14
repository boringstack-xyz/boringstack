import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";

const plugin = pathToFileURL(
  join(
    process.cwd(),
    "node_modules/@boring-stack-pkg/eslint-plugin-i18n-keys/dist/index.js"
  )
).href;

function writeConfig(root: string, fingerprint: boolean): void {
  const digest = fingerprint
    ? `settings: { "i18n-keys/dictionaryDigest": createHash("sha256").update(readFileSync("dictionary.json")).digest("hex") },`
    : "";

  writeFileSync(
    join(root, "eslint.config.mjs"),
    `import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import plugin from ${JSON.stringify(plugin)};
export default [{ ${digest} plugins: { i18n: plugin }, rules: {
"i18n/static-translation-key-exists": ["error", {dictionary: "dictionary.json"}]
} }];`
  );
}

function lintErrors(root: string): number {
  const result = spawnSync(
    process.execPath,
    [
      join(process.cwd(), "node_modules/eslint/bin/eslint.js"),
      "--no-config-lookup",
      "--config",
      "eslint.config.mjs",
      "--cache",
      "--cache-location",
      ".eslintcache",
      "--format",
      "json",
      "case.js"
    ],
    { cwd: root, encoding: "utf8", timeout: 20_000 }
  );
  const report: unknown = JSON.parse(result.stdout);

  expect(Array.isArray(report)).toBe(true);

  const [file] = Array.isArray(report) ? report : [];
  const count: unknown =
    typeof file === "object" && file !== null && "errorCount" in file
      ? file.errorCount
      : undefined;

  expect(typeof count).toBe("number");

  return typeof count === "number" ? count : -1;
}

function scenario(fingerprint: boolean): [number, number] {
  const root = mkdtempSync(join(tmpdir(), "eslint-cache-"));

  try {
    writeConfig(root, fingerprint);
    writeFileSync(join(root, "case.js"), 't("greeting");\n');
    writeFileSync(
      join(root, "dictionary.json"),
      JSON.stringify({ greeting: "Hello" })
    );

    const before = lintErrors(root);

    writeFileSync(join(root, "dictionary.json"), JSON.stringify({}));

    return [before, lintErrors(root)];
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("the dictionary digest in settings invalidates the ESLint result cache", () => {
  expect(scenario(true)).toEqual([0, 1]);
});

test("without the digest a deleted key hides behind the cached result", () => {
  expect(scenario(false)).toEqual([0, 0]);
});
