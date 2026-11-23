// The lint command runs this file after Oxlint (.oxlintrc.json). It holds the rules Oxlint cannot run, and the
// full policy stays in eslint.config.* (tools/ and lint:meta read it). Keep the two in step. See AGENT_CONTRACT.md:
//   - the custom @boring-stack-pkg plugins and the sonarjs, prettier and eslint-comments rules
//   - rules Oxlint 1.94 does not ship (import/no-useless-path-segments, naming-convention, ...)
//   - rules Oxlint covers but reports differently on this codebase, kept here so the policy
//     does not change: id-length (type parameters), no-restricted-globals (typeof fetch),
//     consistent-type-assertions (lint-meta reads its "never" pin from this file),
//     no-meaningless-void-operator, no-unused-expressions, unicorn/prefer-ternary
import tseslint from "typescript-eslint";
import pluginPrettier from "eslint-plugin-prettier";
import pluginCodeFlow from "@boring-stack-pkg/eslint-plugin-code-flow";
import pluginCommentHygiene from "@boring-stack-pkg/eslint-plugin-comment-hygiene";
import pluginEslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import pluginImport from "eslint-plugin-import";
import pluginSonarjs from "eslint-plugin-sonarjs";
import pluginUnicorn from "eslint-plugin-unicorn";
import pluginElysia from "@boring-stack-pkg/eslint-plugin-elysia";
import pluginDrizzle from "@boring-stack-pkg/eslint-plugin-drizzle-conventions";
import pluginBullmq from "@boring-stack-pkg/eslint-plugin-bullmq";
import pluginStripe from "@boring-stack-pkg/eslint-plugin-stripe-webhooks";
import pluginResourceArch from "@boring-stack-pkg/eslint-plugin-resource-architecture";
import pluginModuleBoundaries from "@boring-stack-pkg/eslint-plugin-module-boundaries";
import pluginStructuredLogging from "@boring-stack-pkg/eslint-plugin-structured-logging";
import pluginTestConventions from "@boring-stack-pkg/eslint-plugin-test-conventions";
import pluginEnvAccess from "@boring-stack-pkg/eslint-plugin-env-access";
import pluginJwtCookies from "@boring-stack-pkg/eslint-plugin-jwt-cookies";
import pluginCacheKeys from "@boring-stack-pkg/eslint-plugin-cache-keys";
import pluginDbTransactions from "@boring-stack-pkg/eslint-plugin-db-transactions";
import pluginAuditLog from "@boring-stack-pkg/eslint-plugin-audit-log";
import pluginOauthSecurity from "@boring-stack-pkg/eslint-plugin-oauth-security";

export default [
  {
    ignores: [
      "dist",
      "node_modules",
      "drizzle",
      "*.config.js",
      "src/templates/email/dist/**",
      "src/templates/email/preview/**",
      "tests/lint-meta/fixtures/**",
    ],
  },
  {
    files: [
      "src/**/*.ts",
      "tests/**/*.ts",
      "security-spec/**/*.ts",
      "scripts/**/*.ts",
    ],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: "module",
    },
  },
  {
    files: [
      "src/**/*.ts",
      "tests/**/*.ts",
      "security-spec/**/*.ts",
      "scripts/**/*.ts",
    ],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: "module",
    },
  },
  {
    files: [
      "src/**/*.ts",
      "tests/**/*.ts",
      "security-spec/**/*.ts",
      "scripts/**/*.ts",
    ],
    rules: {
      "no-dupe-args": "error",
      "no-octal": "error",
    },
  },
  {
    files: [
      "src/**/*.ts",
      "tests/**/*.ts",
      "security-spec/**/*.ts",
      "scripts/**/*.ts",
    ],
    rules: {
      "no-dupe-args": "off",
    },
  },
  {
    files: [
      "src/**/*.ts",
      "tests/**/*.ts",
      "security-spec/**/*.ts",
      "scripts/**/*.ts",
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-meaningless-void-operator": "error",
      "@typescript-eslint/no-unused-expressions": "error",
    },
  },
  {
    files: [
      "src/**/*.ts",
      "tests/**/*.ts",
      "security-spec/**/*.ts",
      "scripts/**/*.ts",
    ],
    rules: {
      "no-dupe-args": "off",
    },
  },
  {
    files: [
      "src/**/*.ts",
      "tests/**/*.ts",
      "security-spec/**/*.ts",
      "scripts/**/*.ts",
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/consistent-type-assertions": "error",
    },
  },
  {
    files: [
      "src/**/*.ts",
      "tests/**/*.ts",
      "security-spec/**/*.ts",
      "scripts/**/*.ts",
    ],
    plugins: {
      prettier: pluginPrettier,
      "code-flow": pluginCodeFlow,
      "comment-hygiene": pluginCommentHygiene,
      "eslint-comments": pluginEslintComments,
      "@typescript-eslint": tseslint.plugin,
      import: pluginImport,
      sonarjs: pluginSonarjs,
      unicorn: pluginUnicorn,
      elysia: pluginElysia,
      "drizzle-conventions": pluginDrizzle,
      bullmq: pluginBullmq,
      "stripe-webhooks": pluginStripe,
      "resource-architecture": pluginResourceArch,
      "module-boundaries": pluginModuleBoundaries,
      "structured-logging": pluginStructuredLogging,
      "test-conventions": pluginTestConventions,
      "env-access": pluginEnvAccess,
      "jwt-cookies": pluginJwtCookies,
      "cache-keys": pluginCacheKeys,
      "db-transactions": pluginDbTransactions,
      "audit-log": pluginAuditLog,
      "oauth-security": pluginOauthSecurity,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      ecmaVersion: 2022,
    },
    rules: {
      "prettier/prettier": "error",
      "code-flow/prefer-early-return": "error",
      "code-flow/no-bare-date-now": [
        "error",
        {
          allowedPaths: ["src/lib/time/"],
        },
      ],
      "comment-hygiene/no-historical-comments": "error",
      "comment-hygiene/no-narration-comments": "error",
      "comment-hygiene/no-pr-reference-comments": "error",
      "eslint-comments/no-use": [
        "error",
        {
          allow: [],
        },
      ],
      "multiline-comment-style": ["error", "starred-block"],
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "never",
        },
      ],
      "@typescript-eslint/no-meaningless-void-operator": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "Use 'as const' object literals instead of enums.",
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='toISOString'][callee.object.type='NewExpression'][callee.object.callee.name='Date'][callee.object.arguments.length=0]",
          message:
            "Use now() from @/lib/time/now instead of new Date().toISOString().",
        },
        {
          selector: "SwitchCase > Literal[value=/^[A-Z][A-Z0-9_]+$/]",
          message:
            "Switch cases on enum-shaped values must reference a typed constant (e.g. ElysiaErrorCodes.NOT_FOUND), not a bare string literal.",
        },
        {
          selector:
            "BinaryExpression[operator=/^(===|!==)$/] > Literal[value=/^[A-Z][A-Z0-9_]+$/]",
          message:
            "Equality checks against enum-shaped string literals must reference a typed constant (e.g. ElysiaErrorCodes.NOT_FOUND), not a bare string.",
        },
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "interface",
          format: ["PascalCase"],
          prefix: ["I"],
        },
        {
          selector: "typeAlias",
          format: ["PascalCase"],
        },
        {
          selector: "typeParameter",
          format: ["PascalCase"],
        },
        {
          selector: "enumMember",
          format: ["UPPER_CASE"],
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
          filter: {
            regex: "^__dirname$",
            match: false,
          },
        },
        {
          selector: "memberLike",
          modifiers: ["private"],
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: ["objectLiteralProperty", "typeProperty"],
          format: null,
        },
      ],
      "import/no-useless-path-segments": "error",
      "padding-line-between-statements": [
        "error",
        {
          blankLine: "always",
          prev: "import",
          next: "*",
        },
        {
          blankLine: "any",
          prev: "import",
          next: "import",
        },
        {
          blankLine: "always",
          prev: "*",
          next: "return",
        },
        {
          blankLine: "always",
          prev: "*",
          next: "throw",
        },
        {
          blankLine: "always",
          prev: ["const", "let", "var"],
          next: "*",
        },
        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"],
        },
        {
          blankLine: "always",
          prev: "block-like",
          next: "*",
        },
        {
          blankLine: "always",
          prev: "*",
          next: "block-like",
        },
      ],
      "sonarjs/cognitive-complexity": ["error", 20],
      "sonarjs/no-duplicate-string": [
        "error",
        {
          threshold: 5,
        },
      ],
      "sonarjs/no-identical-functions": "error",
      "sonarjs/no-redundant-jump": "error",
      "sonarjs/no-useless-catch": "error",
      "sonarjs/prefer-immediate-return": "error",
      "sonarjs/prefer-single-boolean-return": "error",
      "unicorn/better-regex": "error",
      "unicorn/no-unused-properties": "error",
      "unicorn/prefer-ternary": "error",
      "elysia/route-requires-schema": [
        "error",
        {
          ignorePathPattern: "^/(health|ready)?$",
        },
      ],
      "elysia/route-requires-tag": "error",
      "elysia/no-direct-error-throw": "error",
      "elysia/consistent-status-via-set": "error",
      "elysia/prefer-destructured-context": "error",
      "elysia/require-hooks-before-routes": "error",
      "elysia/prefer-throw-status": "error",
      "elysia/prefer-direct-return": "error",
      "elysia/no-decorate-state-collision": "error",
      "elysia/portable-schema-types": "error",
      "elysia/route-must-check-ability": [
        "error",
        {
          authzCallees: ["requireAbility", "enforceLimit"],
          membershipParamName: "membership",
        },
      ],
      "drizzle-conventions/tables-must-have-timestamps": "error",
      "drizzle-conventions/timestamp-must-specify-mode": "error",
      "drizzle-conventions/relations-must-cover-fks": "error",
      "drizzle-conventions/no-raw-sql-outside-allowlist": [
        "error",
        {
          allowFiles: [
            "**/migrations/**",
            "**/raw/**",
            "**/health/**",
            "**/*.check.ts",
            "**/tests/**",
            "**/__tests__/**",
            "**/src/clients/postgres/schema/**",
            "**/src/clients/postgres/advisory-lock.ts",
          ],
        },
      ],
      "drizzle-conventions/no-nested-db-transaction": "error",
      "drizzle-conventions/schema-files-must-only-export-schema": "error",
      "drizzle-conventions/schema-files-must-not-import-driver": "error",
      "drizzle-conventions/account-scoped-tables-require-where": [
        "error",
        {
          scopeColumn: "accountId",
          tables: [
            "accountMemberships",
            "accountInvitations",
            "accountFeatureOverrides",
            "accountPlans",
          ],
          alternateScopeColumns: ["userId", "tokenHash"],
          allowFiles: [
            "**/queues/account-maintenance/**",
            "**/api/admin/**",
            "**/tests/**",
          ],
        },
      ],
      "bullmq/worker-must-implement-close": "error",
      "bullmq/worker-must-listen-failed": "error",
      "bullmq/job-name-must-be-constant": "error",
      "bullmq/queue-options-must-set-removeoncomplete": "error",
      "bullmq/queue-options-must-set-removeonfail": "error",
      "bullmq/job-options-must-set-attempts": "error",
      "bullmq/no-blocking-concurrency-zero": "error",
      "bullmq/valkey-client-from-factory": "error",
      "stripe-webhooks/handler-must-verify-signature": [
        "error",
        {
          constructEventNames: [
            "constructEvent",
            "constructEventAsync",
            "verifyResendWebhook",
            "verifySendGridWebhook",
          ],
        },
      ],
      "stripe-webhooks/no-parsed-body-before-verification": [
        "error",
        {
          constructEventNames: [
            "constructEvent",
            "constructEventAsync",
            "verifyResendWebhook",
            "verifySendGridWebhook",
          ],
        },
      ],
      "stripe-webhooks/require-stripe-signature-header": "error",
      "stripe-webhooks/handler-must-handle-event-type": "error",
      "stripe-webhooks/handler-must-be-idempotent": "error",
      "stripe-webhooks/service-must-construct-event": [
        "error",
        {
          constructEventNames: [
            "constructEvent",
            "constructEventAsync",
            "verifyResendWebhook",
            "verifySendGridWebhook",
          ],
        },
      ],
      "resource-architecture/files-must-be-resource-prefixed": "error",
      "resource-architecture/service-must-export-singleton": "error",
      "resource-architecture/pluggable-providers-must-have-noop": [
        "error",
        {
          excludeProviderDirs: ["src/lib/oauth/providers"],
        },
      ],
      "resource-architecture/concern-import-boundaries": "error",
      "resource-architecture/no-cross-resource-internal-imports": "error",
      "module-boundaries/single-semantic-module": [
        "error",
        {
          allow: [
            ["type", "constant"],
            ["constant", "function"],
            ["type", "function"],
            ["class", "constant"],
            ["constant", "class"],
            ["function", "class"],
            ["type", "constant", "function"],
            ["type", "constant", "function", "class"],
          ],
        },
      ],
      "structured-logging/require-event-field": "error",
      "structured-logging/mask-pii-fields": [
        "error",
        {
          maskFunctions: [
            "maskEmailForLogging",
            "maskToken",
            "maskPii",
            "redact",
            "mask",
          ],
        },
      ],
      "structured-logging/no-error-stringify": [
        "error",
        {
          extractorName: "getErrorMessage",
        },
      ],
      "structured-logging/typed-event-names": [
        "error",
        {
          eventNamesModule: "src/config/logger.events.ts",
          eventNamesExport: "LOG_EVENTS",
        },
      ],
      "test-conventions/no-focused-tests": "error",
      "test-conventions/no-direct-db-in-tests": [
        "error",
        {
          testFiles: ["tests/**/*.ts", "security-spec/**/*.ts", "**/*.test.ts"],
          forbiddenPaths: ["**/clients/postgres/**", "drizzle-orm"],
          helpersPath: "tests/helpers/db",
        },
      ],
      "test-conventions/test-file-mirrors-source": "error",
      "env-access/no-direct-process-env": [
        "error",
        {
          allowedFiles: [
            "src/config/env/**",
            "**/*.config.{ts,js,mjs}",
            "scripts/**",
          ],
          singletonSuggestion: "import { env } from '@/config/env'",
        },
      ],
      "env-access/env-var-must-have-schema-entry": [
        "error",
        {
          singletonImportPath: "@/config/env",
          singletonName: "env",
          schemaFile: "src/config/env/schema.ts",
        },
      ],
      "env-access/no-process-exit": [
        "error",
        {
          allowedFiles: [
            "src/config/error-handlers/**",
            "scripts/**",
            "src/templates/email/preview.ts",
            "**/*.test.ts",
            "tests/**",
          ],
        },
      ],
      "jwt-cookies/auth-cookie-must-be-httponly": "error",
      "jwt-cookies/auth-cookie-must-be-secure-in-prod": "error",
      "jwt-cookies/bcrypt-rounds-min": [
        "error",
        {
          minRounds: 12,
        },
      ],
      "cache-keys/cache-set-must-have-ttl": "error",
      "cache-keys/cache-key-must-be-prefixed": [
        "error",
        {
          prefixes: [
            "cache:",
            "jwt:",
            "oauth:",
            "rate:",
            "session:",
            "stripe:",
          ],
        },
      ],
      "db-transactions/multi-write-must-be-transactional": "error",
      "db-transactions/transaction-uses-tx-not-db": "error",
      "audit-log/mutating-service-must-audit": [
        "error",
        {
          mutatingPrefixes: [
            "^(create|update|delete|insert|register|approve|reject|activate|deactivate|enable|disable|complete|cancel|grant|revoke|subscribe|unsubscribe|accept|decline|link|unlink|reset|change|invite|leave|mark|rotate|switch)",
          ],
        },
      ],
      "audit-log/audit-write-must-be-fire-and-forget": [
        "error",
        {
          allowAwaitInsidePatterns: ["tests/**/*.ts", "security-spec/**/*.ts"],
        },
      ],
      "audit-log/audit-metadata-no-pii": "error",
      "oauth-security/state-must-be-redis-backed": "error",
      "oauth-security/pkce-required-for-oidc": "error",
      "oauth-security/state-ttl-bounded": [
        "error",
        {
          maxTtlSeconds: 600,
        },
      ],
    },
  },
  {
    files: ["src/api/**/*.service.ts"],
    plugins: {
      "module-boundaries": pluginModuleBoundaries,
    },
    rules: {
      "module-boundaries/single-semantic-module": [
        "error",
        {
          allow: [
            ["class", "constant"],
            ["constant", "class"],
          ],
        },
      ],
    },
  },
  {
    files: ["src/api/**/*.routes.ts"],
    plugins: {
      "module-boundaries": pluginModuleBoundaries,
    },
    rules: {
      "module-boundaries/single-semantic-module": [
        "error",
        {
          allow: [
            ["type", "constant"],
            ["constant", "function"],
            ["type", "function"],
            ["class", "constant"],
            ["constant", "class"],
            ["function", "class"],
            ["type", "constant", "function"],
            ["type", "constant", "function", "class"],
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/acl/acl.constants.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["src/**/*.ts"],
    ignores: ["src/lib/acl/acl.constants.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "Use 'as const' object literals instead of enums.",
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='toISOString'][callee.object.type='NewExpression'][callee.object.callee.name='Date'][callee.object.arguments.length=0]",
          message:
            "Use now() from @/lib/time/now instead of new Date().toISOString().",
        },
        {
          selector: "SwitchCase > Literal[value=/^[A-Z][A-Z0-9_]+$/]",
          message:
            "Switch cases on enum-shaped values must reference a typed constant (e.g. ElysiaErrorCodes.NOT_FOUND), not a bare string literal.",
        },
        {
          selector:
            "BinaryExpression[operator=/^(===|!==)$/] > Literal[value=/^[A-Z][A-Z0-9_]+$/]",
          message:
            "Equality checks against enum-shaped string literals must reference a typed constant (e.g. ElysiaErrorCodes.NOT_FOUND), not a bare string.",
        },
        {
          selector:
            'Literal[value="owner"], Literal[value="admin"], Literal[value="member"], Literal[value="viewer"]',
          message:
            "Use ROLE.owner/admin/member/viewer from acl.constants.ts instead of raw role string literals.",
        },
      ],
    },
  },
  {
    files: ["tests/**/*.ts", "security-spec/**/*.ts"],
    plugins: {
      elysia: pluginElysia,
      "structured-logging": pluginStructuredLogging,
      "audit-log": pluginAuditLog,
      "db-transactions": pluginDbTransactions,
      "env-access": pluginEnvAccess,
      "code-flow": pluginCodeFlow,
    },
    rules: {
      "elysia/no-direct-error-throw": "off",
      "structured-logging/require-event-field": "off",
      "structured-logging/typed-event-names": "off",
      "audit-log/mutating-service-must-audit": "off",
      "db-transactions/multi-write-must-be-transactional": "off",
      "env-access/no-direct-process-env": "off",
      "code-flow/no-bare-date-now": "off",
    },
  },
  {
    files: ["tests/config/env/**/*.ts"],
    plugins: {
      "env-access": pluginEnvAccess,
    },
    rules: {
      "env-access/no-direct-process-env": "off",
    },
  },
  {
    files: ["tests/lib/cache/**/*.ts"],
    plugins: {
      "cache-keys": pluginCacheKeys,
    },
    rules: {
      "cache-keys/cache-key-must-be-prefixed": "off",
      "cache-keys/cache-set-must-have-ttl": "off",
    },
  },
  {
    files: ["tests/lib/audit-log/**/*.ts"],
    plugins: {
      "test-conventions": pluginTestConventions,
    },
    rules: {
      "test-conventions/no-direct-db-in-tests": "off",
    },
  },
  {
    files: [
      "tests/health.test.ts",
      "tests/lib/email/retry.test.ts",
      "tests/lib/email/validation.test.ts",
      "tests/lib/errors/get-error-message.test.ts",
      "tests/lint-meta/lint-meta.test.ts",
      // Mirrors the lint configuration, not src/.
      "tests/lint-meta/lint-parity.test.ts",
      "tests/scripts/acl-scaffold.test.ts",
      "tests/scripts/security-manifest.test.ts",
      "tests/scripts/new-finding.test.ts",
    ],
    plugins: {
      "test-conventions": pluginTestConventions,
    },
    rules: {
      "test-conventions/test-file-mirrors-source": "off",
    },
  },
  {
    files: ["src/lib/time/**/*.ts", "tests/lib/time/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["scripts/**/*.ts"],
    plugins: {
      elysia: pluginElysia,
      "structured-logging": pluginStructuredLogging,
    },
    rules: {
      "elysia/no-direct-error-throw": "off",
      "structured-logging/no-error-stringify": "off",
    },
  },
  {
    files: ["src/api/webhooks/**/*.ts", "tests/api/webhooks/**/*.ts"],
    plugins: {
      "stripe-webhooks": pluginStripe,
    },
    rules: {
      "stripe-webhooks/require-stripe-signature-header": "off",
      "stripe-webhooks/handler-must-handle-event-type": "off",
      "stripe-webhooks/handler-must-be-idempotent": "off",
      "stripe-webhooks/handler-must-verify-signature": "off",
      "stripe-webhooks/no-parsed-body-before-verification": "off",
      "stripe-webhooks/service-must-construct-event": "off",
    },
  },
  {
    files: ["scripts/lint-meta/rules/source-text/no-raw-role-literals.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["src/templates/email/build.ts", "src/templates/email/preview.ts"],
    plugins: {
      "structured-logging": pluginStructuredLogging,
      "env-access": pluginEnvAccess,
    },
    rules: {
      "structured-logging/no-error-stringify": "off",
      "env-access/no-direct-process-env": "off",
    },
  },
  {
    files: [
      "src/config/env/**/*.ts",
      "src/templates/email/build.ts",
      "src/templates/email/preview.ts",
    ],
    plugins: {
      elysia: pluginElysia,
    },
    rules: {
      "elysia/no-direct-error-throw": "off",
    },
  },
  {
    files: ["src/api/billing/billing.service.ts"],
    plugins: {
      "resource-architecture": pluginResourceArch,
      "module-boundaries": pluginModuleBoundaries,
    },
    rules: {
      "resource-architecture/service-must-export-singleton": "off",
      "module-boundaries/single-semantic-module": [
        "error",
        {
          allow: [
            ["constant", "function", "class"],
            ["type", "constant", "function", "class"],
          ],
        },
      ],
    },
  },
  {
    files: ["src/middleware/**/*.ts", "src/lib/**/*.ts"],
    ignores: [
      "src/middleware/**/*.test.ts",
      "src/middleware/**/*.types.ts",
      "src/middleware/**/*.constants.ts",
      "src/lib/**/*.test.ts",
      "src/lib/**/*.types.ts",
      "src/lib/**/*.constants.ts",
    ],
    plugins: {
      "module-boundaries": pluginModuleBoundaries,
    },
    rules: {
      "module-boundaries/single-semantic-module": [
        "error",
        {
          allow: [
            ["type", "constant"],
            ["constant", "function"],
            ["type", "function"],
            ["class", "constant"],
            ["constant", "class"],
            ["function", "class"],
            ["type", "constant", "function"],
            ["type", "constant", "function", "class"],
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "id-length": [
        "error",
        {
          min: 2,
          exceptions: ["_", "i", "j", "k"],
          properties: "never",
        },
      ],
    },
  },
  {
    files: ["src/lib/cache/providers/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/consistent-type-assertions": "off", // eslint-meta-allow-assertion-exemption: generic <T> cache storage boundary
    },
  },
];
