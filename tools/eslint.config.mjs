import { ESLint } from "../apps/api/node_modules/eslint/lib/api.js";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const apiRoot = fileURLToPath(new URL("../apps/api/", import.meta.url));
const toolsRoot = fileURLToPath(new URL("./", import.meta.url));
const apiLint = new ESLint({ cwd: apiRoot });
const scriptConfig = await apiLint.calculateConfigForFile(
  `${apiRoot}scripts/quality/security-manifest-lib.ts`
);
const formatting = JSON.parse(
  readFileSync(`${apiRoot}.prettierrc.json`, "utf8")
);

// Reuse the API's complete script policy so tooling cannot drift to a weaker rule set.
export default [
  {
    plugins: scriptConfig.plugins,
    linterOptions: { ...scriptConfig.linterOptions, noInlineConfig: true },
    settings: {
      ...(scriptConfig.settings ?? {}),
      // tools/ has no node_modules, so eslint-plugin-import would resolve its
      // named "node" resolver against Bun's global cache instead of the API's
      // pinned copy. Point at the installed file so the lockfile decides.
      "import/resolver": {
        [`${apiRoot}node_modules/eslint-import-resolver-node/index.js`]: {},
      },
    },
    files: ["agent/**/*.ts", "agent-evals/**/*.ts"],
    languageOptions: {
      ...scriptConfig.languageOptions,
      parserOptions: {
        ...scriptConfig.languageOptions.parserOptions,
        project: "./tsconfig.json",
        tsconfigRootDir: toolsRoot,
      },
    },
    rules: {
      ...scriptConfig.rules,
      "id-length": [
        "error",
        { min: 2, exceptions: ["_", "i", "j", "k"], properties: "never" },
      ],
      "lines-between-class-members": ["error", "always"],
      "env-access/no-direct-process-env": [
        "error",
        { allowedFiles: ["**/agent/environment.ts"] },
      ],
      "prettier/prettier": ["error", formatting],
    },
  },
];
