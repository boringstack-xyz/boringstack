// The lint command runs this file after Oxlint (.oxlintrc.json). It holds the rules Oxlint cannot run, and the
// full policy stays in eslint.config.* (tools/ and lint:meta read it). Keep the two in step. See AGENT_CONTRACT.md:
//   - the custom @boring-stack-pkg plugins, JSON linting, eslint-plugin-react-refresh and
//     eslint-plugin-sonarjs rules, and the core rules Oxlint 1.94 does not ship
//   - rules Oxlint covers but reports differently on this codebase, kept here so the policy
//     does not change: no-restricted-globals (typeof fetch), no-meaningless-void-operator,
//     and nonblock-statement-body-position
import pluginCodeFlow from "@boring-stack-pkg/eslint-plugin-code-flow";
import pluginCommentHygiene from "@boring-stack-pkg/eslint-plugin-comment-hygiene";
import pluginEnvAccess from "@boring-stack-pkg/eslint-plugin-env-access";
import pluginI18nKeys from "@boring-stack-pkg/eslint-plugin-i18n-keys";
import pluginModuleBoundaries from "@boring-stack-pkg/eslint-plugin-module-boundaries";
import pluginRCA from "@boring-stack-pkg/eslint-plugin-react-component-architecture";
import pluginStructuredLogging from "@boring-stack-pkg/eslint-plugin-structured-logging";
import pluginTanstackQueryCache from "@boring-stack-pkg/eslint-plugin-tanstack-query-cache";
import pluginTestConventions from "@boring-stack-pkg/eslint-plugin-test-conventions";
import pluginEslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import pluginJson from "@eslint/json";
import pluginImport from "eslint-plugin-import";
import pluginReact from "eslint-plugin-react";
import pluginReactRefresh from "eslint-plugin-react-refresh";
import pluginSonarjs from "eslint-plugin-sonarjs";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import tseslint from "typescript-eslint";

const localeRoot = new URL("./src/lib/i18n/locales/en/", import.meta.url);
const dictionaries = readdirSync(localeRoot)
  .filter((file) => /^[a-z][a-z0-9]*\.json$/u.test(file))
  .sort();
const featureNamespaces = dictionaries
  .filter((file) => file !== "common.json")
  .map((file) => file.slice(0, -5));

// ESLint's result cache keys each file on its content plus a hash of its
// resolved config. The translation dictionaries that `i18n-keys` reads are
// invisible to that hash, so a key deleted from common.json would leave a
// cached "clean" result behind. Carrying a digest of every dictionary in
// `settings` makes the config hash, and therefore the cache, follow them.
const dictionaryDigest = dictionaries
  .reduce(
    (hash, file) => hash.update(readFileSync(new URL(file, localeRoot))),
    createHash("sha256")
  )
  .digest("hex");

export default [
  {
    ignores: [
      "dist",
      "node_modules",
      "storybook-static",
      "playwright-report",
      "test-results",
      "coverage",
      ".eslintcache",
      ".lighthouseci",
      "src/components/ui/**",
      "src/lib/api/schema.d.ts",
      "src/lib/acl/acl.types.generated.ts",
      "tests/lint-meta/fixtures/**",
      "**/*.d.ts",
      "*.config.{js,mjs,cjs}",
      "vite.config.ts",
      "vitest.config.ts",
      "playwright.config.ts",
      "playwright.robot.config.ts",
      ".github/workflows/*.{yml,yaml}",
      "bun.lock"
    ]
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "e2e/**/*.ts",
      "scripts/**/*.ts",
      ".storybook/**/*.{ts,tsx}"
    ],
    settings: {
      "i18n-keys/dictionaryDigest": dictionaryDigest,
      react: {
        version: "19.2"
      },
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json"
        }
      }
    }
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "e2e/**/*.ts",
      "scripts/**/*.ts",
      ".storybook/**/*.{ts,tsx}"
    ],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: "module"
    }
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "e2e/**/*.ts",
      "scripts/**/*.ts",
      ".storybook/**/*.{ts,tsx}"
    ],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: "module"
    }
  },
  {
    files: ["**/*.json"],
    ignores: [
      "node_modules/**",
      "dist/**",
      "storybook-static/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "package-lock.json",
      "**/pnpm-lock.json"
    ],
    language: "json/json",
    plugins: {
      json: pluginJson
    },
    rules: {
      "json/no-duplicate-keys": "error",
      "json/no-empty-keys": "error",
      "json/no-unsafe-values": "error",
      "json/no-unnormalized-keys": "error",
      "json/top-level-interop": "error"
    }
  },
  {
    files: [
      "tsconfig.json",
      "tsconfig.*.json",
      ".vscode/**/*.json",
      "**/*.jsonc"
    ],
    language: "json/jsonc",
    plugins: {
      json: pluginJson
    },
    rules: {
      "json/no-duplicate-keys": "error",
      "json/no-empty-keys": "error"
    }
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "e2e/**/*.ts",
      "scripts/**/*.ts",
      ".storybook/**/*.{ts,tsx}"
    ],
    rules: {
      "no-dupe-args": "error",
      "no-octal": "error"
    }
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "e2e/**/*.ts",
      "scripts/**/*.ts",
      ".storybook/**/*.{ts,tsx}"
    ],
    rules: {
      "no-dupe-args": "off"
    }
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "e2e/**/*.ts",
      "scripts/**/*.ts",
      ".storybook/**/*.{ts,tsx}"
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin
    },
    rules: {
      "@typescript-eslint/no-meaningless-void-operator": "error",
      "@typescript-eslint/no-unsafe-class-instance-assignment": "error",
      "@typescript-eslint/no-unused-expressions": "error"
    }
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "e2e/**/*.ts",
      "scripts/**/*.ts",
      ".storybook/**/*.{ts,tsx}"
    ],
    rules: {
      "no-dupe-args": "off"
    }
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "e2e/**/*.ts",
      "scripts/**/*.ts",
      ".storybook/**/*.{ts,tsx}"
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin
    },
    rules: {
      "@typescript-eslint/consistent-type-assertions": "error"
    }
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "e2e/**/*.ts",
      "scripts/**/*.ts",
      ".storybook/**/*.{ts,tsx}"
    ],
    rules: {
      "nonblock-statement-body-position": "off"
    }
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "e2e/**/*.ts",
      "scripts/**/*.ts",
      ".storybook/**/*.{ts,tsx}"
    ],
    plugins: {
      "code-flow": pluginCodeFlow,
      "comment-hygiene": pluginCommentHygiene,
      "eslint-comments": pluginEslintComments,
      "@typescript-eslint": tseslint.plugin,
      "i18n-keys": pluginI18nKeys,
      react: pluginReact,
      "react-refresh": pluginReactRefresh,
      import: pluginImport,
      sonarjs: pluginSonarjs,
      "structured-logging": pluginStructuredLogging,
      "env-access": pluginEnvAccess,
      "module-boundaries": pluginModuleBoundaries,
      "test-conventions": pluginTestConventions,
      "react-component-architecture": pluginRCA
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      },
      ecmaVersion: 2023
    },
    rules: {
      "nonblock-statement-body-position": ["error", "below"],
      "code-flow/prefer-early-return": "error",
      "code-flow/no-bare-date-now": [
        "error",
        {
          allowedPaths: ["src/lib/time/"]
        }
      ],
      "comment-hygiene/no-historical-comments": "error",
      "comment-hygiene/no-narration-comments": "error",
      "comment-hygiene/no-pr-reference-comments": "error",
      "eslint-comments/no-use": [
        "error",
        {
          allow: []
        }
      ],
      "multiline-comment-style": ["error", "starred-block"],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='toISOString'][callee.object.type='NewExpression'][callee.object.callee.name='Date'][callee.object.arguments.length=0]",
          message:
            "Use now() from @/lib/time/now instead of new Date().toISOString()."
        }
      ],
      "consistent-return": "error",
      "padding-line-between-statements": [
        "error",
        {
          blankLine: "always",
          prev: "import",
          next: "*"
        },
        {
          blankLine: "any",
          prev: "import",
          next: "import"
        },
        {
          blankLine: "always",
          prev: "*",
          next: "return"
        },
        {
          blankLine: "always",
          prev: "*",
          next: "throw"
        },
        {
          blankLine: "always",
          prev: ["const", "let", "var"],
          next: "*"
        },
        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"]
        },
        {
          blankLine: "always",
          prev: "block-like",
          next: "*"
        },
        {
          blankLine: "always",
          prev: "*",
          next: "block-like"
        }
      ],
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "never"
        }
      ],
      "i18n-keys/static-translation-key-exists": [
        "error",
        {
          dictionary: "src/lib/i18n/locales/en/common.json"
        }
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "interface",
          format: ["PascalCase"],
          prefix: ["I"]
        },
        {
          selector: "typeAlias",
          format: ["PascalCase"]
        },
        {
          selector: "variable",
          modifiers: ["const", "global"],
          format: ["UPPER_CASE", "PascalCase", "camelCase"]
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"]
        }
      ],
      "react/jsx-no-bind": [
        "error",
        {
          allowArrowFunctions: false,
          allowBind: false,
          allowFunctions: false,
          ignoreRefs: true,
          ignoreDOMComponents: false
        }
      ],
      "react/jsx-uses-vars": "error",
      "react-refresh/only-export-components": [
        "error",
        {
          allowConstantExport: true
        }
      ],
      "import/no-useless-path-segments": "error",
      "sonarjs/cognitive-complexity": ["error", 20],
      "structured-logging/require-event-field": "error",
      "structured-logging/mask-pii-fields": "error",
      "structured-logging/no-error-stringify": "error",
      "structured-logging/typed-event-names": [
        "error",
        {
          eventNamesModule: "src/lib/logger/logger.events.ts",
          eventNamesExport: "LOG_EVENTS"
        }
      ],
      "env-access/no-direct-process-env": "error",
      "module-boundaries/single-semantic-module": [
        "error",
        {
          allow: [],
          ignorePrivateDeclarations: true
        }
      ],
      "test-conventions/no-focused-tests": "error",
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Use the typed OpenAPI client (`@/lib/api/client`) instead of raw fetch."
        }
      ],
      "react-component-architecture/classnames-required": "error",
      "react-component-architecture/classnames-import-name": "error",
      "react-component-architecture/no-dark-mode-classes": "error",
      "react-component-architecture/no-inline-jsx-functions": "error",
      "react-component-architecture/interface-prefix-i": "error",
      "react-component-architecture/forwardref-display-name": "error",
      "react-component-architecture/stories-require-default-export": "error",
      "react-component-architecture/react-import-named": "error",
      "react-component-architecture/index-must-reexport-default": "error",
      "react-component-architecture/component-folder-structure": [
        "error",
        {
          requiredSiblings: [
            "<Name>.hooks.ts",
            "<Name>.types.ts",
            "<Name>.stories.tsx",
            "<Name>.test.tsx",
            "index.ts"
          ]
        }
      ],
      "react-component-architecture/no-state-in-component-body": "error",
      "react-component-architecture/no-jsx-computation": "error",
      "react-component-architecture/props-must-be-visual": "error",
      "react-component-architecture/no-untranslated-jsx-text": "error",
      "react-component-architecture/query-keys-must-be-constant": "error",
      "react-component-architecture/max-hooks-per-file": [
        "error",
        {
          threshold: 4
        }
      ],
      "react-component-architecture/no-cross-feature-imports": [
        "error",
        {
          allowSiblingTypes: true,
          allowList: [["accounts", "auth"]]
        }
      ]
    }
  },
  {
    files: [
      "src/app/**/*.tsx",
      "src/components/global/**/*.tsx",
      "src/lib/**/*.tsx"
    ],
    plugins: {
      "react-component-architecture": pluginRCA,
      "module-boundaries": pluginModuleBoundaries
    },
    rules: {
      "react-component-architecture/component-folder-structure": "off",
      "react-component-architecture/no-state-in-component-body": "off",
      "module-boundaries/single-semantic-module": "off"
    }
  },
  {
    files: ["src/**/*.queries.ts"],
    plugins: {
      "tanstack-query-cache": pluginTanstackQueryCache
    },
    rules: {
      "tanstack-query-cache/prefix-query-key-must-use-set-queries-data": "error"
    }
  },
  {
    files: ["src/features/**/components/*Page/*.tsx"],
    ignores: [
      "src/features/**/components/*Page/*Page.tsx",
      "**/*.test.tsx",
      "**/*.stories.tsx"
    ],
    plugins: {
      "react-component-architecture": pluginRCA
    },
    rules: {
      "react-component-architecture/component-folder-structure": "off"
    }
  },
  {
    files: ["src/**/*.hooks.ts"],
    plugins: {
      "module-boundaries": pluginModuleBoundaries
    },
    rules: {
      "module-boundaries/single-semantic-module": [
        "error",
        {
          allow: [
            ["type", "hook"],
            ["function", "hook"],
            ["type", "function", "hook"]
          ]
        }
      ]
    }
  },
  {
    files: ["src/**/*.store.ts"],
    plugins: {
      "module-boundaries": pluginModuleBoundaries
    },
    rules: {
      "module-boundaries/single-semantic-module": "off"
    }
  },
  {
    files: ["src/lib/env/**/*.ts"],
    plugins: {
      "env-access": pluginEnvAccess
    },
    rules: {
      "env-access/no-direct-process-env": "off"
    }
  },
  {
    files: ["src/lib/api/openapi.ts"],
    plugins: {
      "module-boundaries": pluginModuleBoundaries
    },
    rules: {
      "no-restricted-globals": "off",
      "module-boundaries/single-semantic-module": "off"
    }
  },
  {
    files: ["src/lib/time/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off"
    }
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/acl/acl.types.generated.ts",
      "src/lib/api/schema.d.ts",
      "src/lib/time/**/*.ts"
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='toISOString'][callee.object.type='NewExpression'][callee.object.callee.name='Date'][callee.object.arguments.length=0]",
          message:
            "Use now() from @/lib/time/now instead of new Date().toISOString()."
        },
        {
          selector:
            'Literal[value="owner"], Literal[value="admin"], Literal[value="member"], Literal[value="viewer"]',
          message:
            "Use ROLE.owner/admin/member/viewer from acl.types instead of raw role string literals."
        }
      ]
    }
  },
  {
    files: ["src/**/*.stories.tsx", ".storybook/**/*.{ts,tsx}"],
    plugins: {
      react: pluginReact,
      "react-refresh": pluginReactRefresh,
      "structured-logging": pluginStructuredLogging
    },
    rules: {
      "react/jsx-no-bind": "off",
      "react-refresh/only-export-components": "off",
      "structured-logging/require-event-field": "off",
      "structured-logging/typed-event-names": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='toISOString'][callee.object.type='NewExpression'][callee.object.callee.name='Date'][callee.object.arguments.length=0]",
          message:
            "Use now() from @/lib/time/now instead of new Date().toISOString()."
        }
      ]
    }
  },
  {
    files: ["tests/**/*.{ts,tsx}", "src/**/*.test.{ts,tsx}", "e2e/**/*.ts"],
    plugins: {
      "structured-logging": pluginStructuredLogging,
      "@typescript-eslint": tseslint.plugin,
      react: pluginReact,
      sonarjs: pluginSonarjs,
      "module-boundaries": pluginModuleBoundaries,
      "code-flow": pluginCodeFlow
    },
    rules: {
      "structured-logging/require-event-field": "off",
      "structured-logging/mask-pii-fields": "off",
      "structured-logging/typed-event-names": "off",
      "@typescript-eslint/consistent-type-assertions": "off", // eslint-meta-allow-assertion-exemption: tests construct partial mocks across the type boundary
      "react/jsx-no-bind": "off",
      "sonarjs/cognitive-complexity": "off",
      "module-boundaries/single-semantic-module": "off",
      "code-flow/no-bare-date-now": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='toISOString'][callee.object.type='NewExpression'][callee.object.callee.name='Date'][callee.object.arguments.length=0]",
          message:
            "Use now() from @/lib/time/now instead of new Date().toISOString()."
        }
      ]
    }
  },
  {
    files: ["src/**/*.stories.tsx"],
    plugins: {
      "module-boundaries": pluginModuleBoundaries
    },
    rules: {
      "module-boundaries/single-semantic-module": "off"
    }
  },
  {
    files: [
      "scripts/**/*.ts",
      "*.config.{ts,mts,mjs,js}",
      ".storybook/**/*.{ts,tsx}"
    ],
    plugins: {
      "structured-logging": pluginStructuredLogging,
      "env-access": pluginEnvAccess,
      "module-boundaries": pluginModuleBoundaries
    },
    rules: {
      "structured-logging/require-event-field": "off",
      "structured-logging/typed-event-names": "off",
      "env-access/no-direct-process-env": "off",
      "no-restricted-globals": "off",
      "module-boundaries/single-semantic-module": "off"
    }
  },
  {
    files: ["scripts/lint-meta/rules/source-text/no-raw-role-literals.ts"],
    rules: {
      "no-restricted-syntax": "off"
    }
  },
  ...featureNamespaces.map((namespace) => ({
    files: [`src/features/${namespace}/**/*.{ts,tsx}`],
    rules: {
      "i18n-keys/static-translation-key-exists": [
        "error",
        { dictionary: `src/lib/i18n/locales/en/${namespace}.json` }
      ]
    }
  }))
];
