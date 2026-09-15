import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";

import { checkI18nLocaleKeysUsed } from "../../scripts/lint-meta/rules/source-text/i18n-locale-keys-used";

const FEATURE_NAMESPACE = "src/lib/i18n/locales/en/posts.json";

function generate(root: string) {
  return spawnSync(
    process.execPath,
    [
      join(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
      join(process.cwd(), "scripts/codegen/new-feature.ts"),
      "Posts",
      "--i18n-namespace"
    ],
    { cwd: root, encoding: "utf8", timeout: 10_000 }
  );
}

test("namespace scaffolding wires dictionaries, lint scope, and a separate bundle budget", () => {
  const root = mkdtempSync(join(tmpdir(), "feature-namespace-"));

  try {
    for (const language of ["en", "de"]) {
      const directory = join(root, "src/lib/i18n/locales", language);

      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "common.json"), "{}");
    }

    writeFileSync(join(root, ".size-limit.json"), "[]");
    const result = generate(root);

    expect(result.status, result.stderr).toBe(0);
    const dictionary = readFileSync(join(root, FEATURE_NAMESPACE), "utf8");

    expect(
      readFileSync(join(root, "src/lib/i18n/locales/de/posts.json"), "utf8")
    ).toBe(dictionary);
    expect(JSON.parse(dictionary)).toMatchObject({
      features: { posts: { title: "Posts" } }
    });
    const component = join(
      root,
      "src/features/posts/components/PostsPage/PostsPage.tsx"
    );
    const constants = join(
      root,
      "src/features/posts/components/PostsPage/PostsPage.constants.ts"
    );

    expect(readFileSync(component, "utf8")).toContain('useNamespace("posts")');
    expect(checkI18nLocaleKeysUsed(root, [component, constants])).toEqual([]);
    expect(checkI18nLocaleKeysUsed(root, [])).toHaveLength(3);
    expect(
      JSON.parse(readFileSync(join(root, ".size-limit.json"), "utf8"))
    ).toEqual([
      {
        name: "Posts translations (all locales)",
        path: "dist/assets/posts-*.js",
        limit: "10 KB",
        gzip: true,
        running: false
      }
    ]);

    copyFileSync("eslint.config.mjs", join(root, "eslint.config.mjs"));
    symlinkSync(
      join(process.cwd(), "node_modules"),
      join(root, "node_modules")
    );
    const eslintUrl = pathToFileURL(
      join(process.cwd(), "node_modules/eslint/lib/api.js")
    ).href;

    writeFileSync(
      join(root, "inspect.mjs"),
      `
import { ESLint } from ${JSON.stringify(eslintUrl)};
const eslint = new ESLint({cwd: process.cwd()});
const configuration = await eslint.calculateConfigForFile(${JSON.stringify(component)});
console.log(JSON.stringify(configuration.rules["i18n-keys/static-translation-key-exists"]));
`
    );
    const config = spawnSync(process.execPath, ["inspect.mjs"], {
      cwd: root,
      encoding: "utf8",
      timeout: 10_000
    });

    expect(config.status, config.stderr).toBe(0);
    expect(JSON.parse(config.stdout)).toEqual([
      2,
      { dictionary: FEATURE_NAMESPACE }
    ]);
    expect(generate(root).status).toBe(1);
    expect(readFileSync(join(root, FEATURE_NAMESPACE), "utf8")).toBe(
      dictionary
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

test("a namespace collision is rejected before the feature is written", () => {
  const root = mkdtempSync(join(tmpdir(), "feature-namespace-conflict-"));

  try {
    mkdirSync(join(root, "src/lib/i18n/locales/en"), { recursive: true });
    writeFileSync(join(root, FEATURE_NAMESPACE), "{}");
    expect(generate(root).status).toBe(1);
    expect(existsSync(join(root, "src/features/posts"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
