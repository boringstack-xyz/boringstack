import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint, type Linter } from "../../apps/api/node_modules/eslint";
import * as prettier from "../../apps/api/node_modules/prettier/index";
import { isRecord } from "./validation";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const API_ROOT = join(ROOT, "apps/api");
const WRITE = process.argv.includes("--write");
const apiLint = new ESLint({ cwd: API_ROOT });
const loadedConfig: unknown = await apiLint.calculateConfigForFile(
  join(API_ROOT, "scripts/quality/security-manifest-lib.ts")
);

function isFormattingPolicy(value: unknown): value is Linter.Config {
  return (
    isRecord(value) &&
    isRecord(value.rules) &&
    isRecord(value.languageOptions) &&
    isRecord(value.plugins)
  );
}

if (!isFormattingPolicy(loadedConfig)) {
  throw new Error("API script policy is unavailable");
}

const scriptConfig = loadedConfig;

const layoutRules: Linter.RulesRecord = {
  "lines-between-class-members": ["error", "always"],
};

for (const name of [
  "curly",
  "padding-line-between-statements",
  "import/newline-after-import",
  "multiline-comment-style",
]) {
  const rule = scriptConfig.rules?.[name];

  if (rule === undefined) {
    throw new Error(`Missing template layout rule: ${name}`);
  }

  layoutRules[name] = rule;
}

const templateLint = new ESLint({
  cwd: API_ROOT,
  overrideConfigFile: true,
  fix: true,
  overrideConfig: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      languageOptions: { parser: scriptConfig.languageOptions?.parser },
      plugins: scriptConfig.plugins,
      rules: layoutRules,
    },
  ],
});
let mismatches = 0;

for (const relativePath of new Bun.Glob(
  "tools/**/*.{ts,tsx,mjs,json,md,template}"
).scanSync({ cwd: ROOT })) {
  if (
    !relativePath.startsWith("tools/agent/") &&
    !relativePath.startsWith("tools/agent-evals/") &&
    relativePath !== "tools/eslint.config.mjs" &&
    relativePath !== "tools/tsconfig.json"
  ) {
    continue;
  }

  const path = join(ROOT, relativePath);
  const original = readFileSync(path, "utf8");
  const isTemplate = path.endsWith(".template");
  const isUi =
    relativePath.includes("reference-ui/") ||
    /(?:cache.*tsx|projects.spec.ts)\.template$/.test(relativePath);
  const appRoot = join(ROOT, isUi ? "apps/ui" : "apps/api");
  const config = await prettier.resolveConfig(
    join(appRoot, ".prettierrc.json")
  );
  const requireApp = createRequire(join(appRoot, "package.json"));
  const plugins = config?.plugins?.map((plugin) =>
    typeof plugin === "string" ? requireApp.resolve(plugin) : plugin
  );
  let source = original;

  if (isTemplate) {
    const [linted] = await templateLint.lintText(source, {
      filePath: "scripts/template.tsx",
    });

    if (linted === undefined || linted.errorCount > 0) {
      throw new Error(`Template layout cannot be normalized: ${relativePath}`);
    }

    source = linted.output ?? source;
  }

  const formatted = await prettier.format(source, {
    ...config,
    ...(plugins === undefined ? {} : { plugins }),
    filepath: isTemplate ? path.slice(0, -".template".length) : path,
  });

  if (formatted === original) {
    continue;
  }

  mismatches++;

  if (WRITE) {
    writeFileSync(path, formatted);
  } else {
    console.error(`Formatting differs: ${relativePath}`);
  }
}

console.log(
  `${WRITE ? "Formatted" : "Checked"} tooling and templates; ${String(mismatches)} ${WRITE ? "updated" : "differences"}.`
);
process.exitCode = !WRITE && mismatches > 0 ? 1 : 0;
