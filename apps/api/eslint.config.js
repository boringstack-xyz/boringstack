import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginPrettier from "eslint-plugin-prettier";
import configPrettier from "eslint-config-prettier";
import pluginEslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import pluginImport from "eslint-plugin-import";
import pluginPromise from "eslint-plugin-promise";
import pluginSonarjs from "eslint-plugin-sonarjs";
import pluginUnicorn from "eslint-plugin-unicorn";

// Custom architectural plugins, published from
// https://github.com/boringstack-xyz/eslint-plugins
import pluginAuditLog from "@boring-stack-pkg/eslint-plugin-audit-log";
import pluginBullmq from "@boring-stack-pkg/eslint-plugin-bullmq";
import pluginCacheKeys from "@boring-stack-pkg/eslint-plugin-cache-keys";
import pluginCodeFlow from "@boring-stack-pkg/eslint-plugin-code-flow";
import pluginCommentHygiene from "@boring-stack-pkg/eslint-plugin-comment-hygiene";
import pluginDbTransactions from "@boring-stack-pkg/eslint-plugin-db-transactions";
import pluginDrizzle from "@boring-stack-pkg/eslint-plugin-drizzle-conventions";
import pluginElysia from "@boring-stack-pkg/eslint-plugin-elysia";
import pluginEnvAccess from "@boring-stack-pkg/eslint-plugin-env-access";
import pluginJwtCookies from "@boring-stack-pkg/eslint-plugin-jwt-cookies";
import pluginModuleBoundaries from "@boring-stack-pkg/eslint-plugin-module-boundaries";
import pluginOauthSecurity from "@boring-stack-pkg/eslint-plugin-oauth-security";
import pluginResourceArch from "@boring-stack-pkg/eslint-plugin-resource-architecture";
import pluginStripe from "@boring-stack-pkg/eslint-plugin-stripe-webhooks";
import pluginStructuredLogging from "@boring-stack-pkg/eslint-plugin-structured-logging";
import pluginTestConventions from "@boring-stack-pkg/eslint-plugin-test-conventions";

// AI-first linting: every rule that catches a likely agent mistake is an
// `error`, not a `warn`. Agents iterate by running `bun run check` and reading
// failures; warnings are easy to miss in that loop, so we collapse the
// severity space to error/off only.
//
// Notable hard denials:
//   - `any` (use `unknown` + narrow)
//   - `as` casting (use type guards / generics; only `as const` is permitted)
//   - non-null `!` assertions
//   - floating / misused promises
//   - unchecked switch exhaustiveness
//   - implicit string coercion in template literals
//
// Adjust per-project if a rule fights real intent — but the default bar is
// high so the agent can self-correct without a human in the loop.

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "drizzle",
      "*.config.js",
      "src/templates/email/dist/**",
      "src/templates/email/preview/**",
      /*
       * Fixtures intentionally contain forbidden patterns to exercise
       * lint-meta rules. They must not be scanned by ESLint itself.
       */
      "tests/lint-meta/fixtures/**",
    ],
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts"],
    extends: [
      pluginJs.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      configPrettier,
    ],
    languageOptions: {
      globals: globals.node,
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      prettier: pluginPrettier,
      import: pluginImport,
      promise: pluginPromise,
      "eslint-comments": pluginEslintComments,
      sonarjs: pluginSonarjs,
      unicorn: pluginUnicorn,
      "audit-log": pluginAuditLog,
      bullmq: pluginBullmq,
      "cache-keys": pluginCacheKeys,
      "code-flow": pluginCodeFlow,
      "comment-hygiene": pluginCommentHygiene,
      "db-transactions": pluginDbTransactions,
      "drizzle-conventions": pluginDrizzle,
      elysia: pluginElysia,
      "env-access": pluginEnvAccess,
      "jwt-cookies": pluginJwtCookies,
      "module-boundaries": pluginModuleBoundaries,
      "oauth-security": pluginOauthSecurity,
      "resource-architecture": pluginResourceArch,
      "stripe-webhooks": pluginStripe,
      "structured-logging": pluginStructuredLogging,
      "test-conventions": pluginTestConventions,
    },
    rules: {
      "prettier/prettier": "error",
      "code-flow/prefer-early-return": "error",
      "code-flow/no-bare-date-now": [
        "error",
        { allowedPaths: ["src/lib/time/"] },
      ],
      "comment-hygiene/no-historical-comments": "error",
      "comment-hygiene/no-narration-comments": "error",
      "comment-hygiene/no-pr-reference-comments": "error",

      /*
       * Defense-in-depth ban on inline lint suppression. lint-meta.ts
       * enforces the same ban at merge gate via source-text scan; this
       * rule adds IDE-level feedback while typing.
       */
      "eslint-comments/no-use": ["error", { allow: [] }],

      /*
       * Multi-line comment blocks must use a single /* ... *\/ block,
       * not 3+ consecutive // lines. Cleaner diffs, JSDoc parity.
       */
      "multiline-comment-style": ["error", "starred-block"],

      // ---------------------------------------------------------------------
      // Hard bans — things an AI agent must never write
      // ---------------------------------------------------------------------
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "never",
        },
      ],
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-useless-template-literals": "off",

      // ---------------------------------------------------------------------
      // Async correctness — async bugs are the #1 silent agent failure
      // ---------------------------------------------------------------------
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      "@typescript-eslint/require-await": "error",
      // We deliberately omit `promise-function-async`. It conflicts with
      // `require-await` for legitimate sync methods that satisfy an async
      // interface contract: forcing `async` triggers `require-await`,
      // forcing `() => Promise.resolve(...)` triggers `promise-function-async`.
      // `require-await` is the rule that catches real mistakes; this one
      // is purely stylistic, so it loses.

      // ---------------------------------------------------------------------
      // Type-safety hygiene
      // ---------------------------------------------------------------------
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowString: false,
          allowNumber: false,
          // Allow `if (user)` for `T | undefined | null` — this is the
          // standard Drizzle/ORM pattern and rejecting it forces noisy
          // `=== undefined` boilerplate everywhere.
          allowNullableObject: true,
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
          allowAny: false,
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          // Webhook handlers etc. switch on third-party unions with hundreds
          // of variants — a `default:` arm is the right pattern there.
          considerDefaultExhaustiveForUnions: true,
        },
      ],
      "@typescript-eslint/no-redundant-type-constituents": "error",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/restrict-plus-operands": "error",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: false, allowNullish: false },
      ],
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-confusing-void-expression": "error",
      "@typescript-eslint/no-meaningless-void-operator": "error",
      "@typescript-eslint/no-mixed-enums": "error",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/prefer-reduce-type-parameter": "error",
      "@typescript-eslint/prefer-return-this-type": "error",
      "@typescript-eslint/prefer-string-starts-ends-with": "error",
      "@typescript-eslint/require-array-sort-compare": "error",

      // ---------------------------------------------------------------------
      // General hygiene
      // ---------------------------------------------------------------------
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/array-type": ["error", { default: "array" }],
      "@typescript-eslint/method-signature-style": ["error", "property"],

      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "no-console": "error",
      "no-debugger": "error",
      "no-throw-literal": "error",
      "prefer-const": "error",
      "no-var": "error",
      // Elysia's handler signature exposes `set.status = ...` as the
      // canonical way to set a response status. Param reassignment is still
      // disallowed; only prop mutation is permitted for the framework idiom.
      "no-param-reassign": ["error", { props: false }],
      "no-return-assign": "error",
      "no-implicit-coercion": "error",
      /*
       * Combined no-restricted-syntax rule. ESLint allows only one per
       * config block, so all banned AST shapes live here.
       */
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "Use 'as const' object literals instead of enums.",
        },
        {
          /*
           * Bare `new Date().toISOString()` only — i.e. no constructor
           * arguments. `new Date(x).toISOString()` is intentional (often
           * expiry / TTL math) and stays in place.
           */
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='toISOString'][callee.object.type='NewExpression'][callee.object.callee.name='Date'][callee.object.arguments.length=0]",
          message:
            "Use now() from @/lib/time/now instead of new Date().toISOString().",
        },
        {
          /*
           * Switch-case values that look like enum constants
           * (`UPPER_SNAKE_CASE`) must reference a typed constant, not a
           * bare string literal. If `code === "NOT_FOUND"` is mindless,
           * `case "NOT_FOUND":` is the same smell with extra steps.
           * Catches mostly-uppercase tokens of length ≥ 2.
           */
          selector: "SwitchCase > Literal[value=/^[A-Z][A-Z0-9_]+$/]",
          message:
            "Switch cases on enum-shaped values must reference a typed constant (e.g. ElysiaErrorCodes.NOT_FOUND), not a bare string literal.",
        },
        {
          /*
           * Equality / inequality checks against an enum-shaped literal —
           * `code === "NOT_FOUND"`, `status !== "ACTIVE"` — share the
           * same smell. Reference the const.
           */
          selector:
            "BinaryExpression[operator=/^(===|!==)$/] > Literal[value=/^[A-Z][A-Z0-9_]+$/]",
          message:
            "Equality checks against enum-shaped string literals must reference a typed constant (e.g. ElysiaErrorCodes.NOT_FOUND), not a bare string.",
        },
      ],

      // ---------------------------------------------------------------------
      // Naming conventions — enforces the AGENTS.md identifier shape
      // ---------------------------------------------------------------------
      "@typescript-eslint/naming-convention": [
        "error",
        // Interfaces MUST start with `I` and be PascalCase.
        {
          selector: "interface",
          format: ["PascalCase"],
          prefix: ["I"],
        },
        // Type aliases — PascalCase, no enforced prefix (allows `OAuthProvider`,
        // `IAIChatOptions`, etc. — interface-like aliases keep the I-prefix
        // when they shape a contract).
        {
          selector: "typeAlias",
          format: ["PascalCase"],
        },
        // Type params: single-letter or PascalCase with `T` prefix.
        {
          selector: "typeParameter",
          format: ["PascalCase"],
        },
        // Enum members get UPPER_CASE (we ban enums, but `as const` constant
        // objects use the same rule via the `variable` selector below).
        {
          selector: "enumMember",
          format: ["UPPER_CASE"],
        },
        // Variables — camelCase by default, UPPER_CASE for module-level
        // `const` literals (top-level constants).
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
          // `__dirname` is the canonical Node shim built from
          // `fileURLToPath(import.meta.url)` — pre-approved.
          filter: { regex: "^__dirname$", match: false },
        },
        // Class / abstract members — camelCase methods + properties.
        {
          selector: "memberLike",
          modifiers: ["private"],
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        // Functions — camelCase or PascalCase (PascalCase for factories /
        // class-like factory functions).
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        // Object-literal property names: relaxed because we hit JSON keys,
        // HTTP headers (`HTTP-Referer`), and provider-specific casings.
        {
          selector: ["objectLiteralProperty", "typeProperty"],
          format: null,
        },
      ],

      /*
       * Identifier length floor — applied via per-path override below
       * (production `src/` only). Tests + scripts use shorthand fixture
       * names (`a, b` for two distinct accounts in an isolation test)
       * that benefit from being short rather than verbose. Loop indexes
       * (`i, j, k`) and unused destructure (`_`) are always exempt.
       */

      // ---------------------------------------------------------------------
      // Import hygiene — sorted, deduped, no circular cycles
      // ---------------------------------------------------------------------
      "import/no-duplicates": "error",
      "import/no-self-import": "error",
      "import/no-useless-path-segments": "error",
      "import/first": "error",
      "import/newline-after-import": "error",

      // Vertical-rhythm formatting (mirrored from apps/ui). Forces a
      // blank line before `return`, after the imports cluster, around
      // block-likes, and after declaration groups. Auto-fixable, so
      // `bun run lint:fix` handles it after touching a file. Without
      // this rule, agents pack dense walls of code that pass typecheck
      // but are hard to read.
      "padding-line-between-statements": [
        "error",
        // Rules are evaluated in order; last match wins. Put the broader
        // rule first and exceptions after.
        //
        // Imports first: separate the cluster from code, but allow tight
        // packing inside the cluster (and let Prettier's import-sorter
        // group them by category — those gaps don't count as "missing").
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "any", prev: "import", next: "import" },
        // Always blank line before a return.
        { blankLine: "always", prev: "*", next: "return" },
        // Always blank line before a throw (terminal statements deserve
        // visual separation from the work that built up to them).
        { blankLine: "always", prev: "*", next: "throw" },
        // Always blank line after a group of declarations (let/const/var)
        // unless the next statement is another declaration.
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"],
        },
        // Block-likes (if/for/while/try/switch/etc.) are separated from
        // surrounding code by blank lines on both sides.
        { blankLine: "always", prev: "block-like", next: "*" },
        { blankLine: "always", prev: "*", next: "block-like" },
      ],

      // ---------------------------------------------------------------------
      // Promise hygiene
      // ---------------------------------------------------------------------
      "promise/no-return-wrap": "error",
      "promise/param-names": "error",
      "promise/no-nesting": "error",
      "promise/no-promise-in-callback": "error",

      // ---------------------------------------------------------------------
      // Complexity / dead code (sonarjs)
      // ---------------------------------------------------------------------
      "sonarjs/cognitive-complexity": ["error", 20],
      "sonarjs/no-duplicate-string": ["error", { threshold: 5 }],
      "sonarjs/no-identical-functions": "error",
      "sonarjs/no-redundant-jump": "error",
      "sonarjs/no-small-switch": "off",
      "sonarjs/no-useless-catch": "error",
      "sonarjs/prefer-immediate-return": "error",
      "sonarjs/prefer-single-boolean-return": "error",

      // ---------------------------------------------------------------------
      // Modern JS hygiene (unicorn — only the rules that match our style)
      // ---------------------------------------------------------------------
      "unicorn/better-regex": "error",
      "unicorn/error-message": "error",
      "unicorn/escape-case": "error",
      "unicorn/no-array-for-each": "off", // .forEach is fine
      "unicorn/no-await-expression-member": "error",
      "unicorn/no-instanceof-array": "error",
      "unicorn/no-lonely-if": "error",
      "unicorn/no-static-only-class": "error",
      "unicorn/no-this-assignment": "error",
      "unicorn/no-unused-properties": "error",
      "unicorn/no-useless-promise-resolve-reject": "error",
      "unicorn/no-useless-spread": "error",
      "unicorn/prefer-array-find": "error",
      "unicorn/prefer-array-some": "error",
      "unicorn/prefer-includes": "error",
      "unicorn/prefer-string-starts-ends-with": "error",
      "unicorn/prefer-ternary": "error",
      "unicorn/throw-new-error": "error",

      // ---------------------------------------------------------------------
      // Custom architectural plugins (@boring-stack-pkg/eslint-plugin-*)
      // ---------------------------------------------------------------------
      "elysia/route-requires-schema": [
        "error",
        {
          // Health probes (liveness/readiness) and the root index are
          // intentionally schemaless — orchestrators just need 200/503.
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
      /*
       * Every Elysia route handler that destructures `membership` from
       * its context MUST authorize the action explicitly. Either read
       * `membership.role` directly, or call one of the configured
       * authzCallees. Server authorization must never be implicit.
       */
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
          /*
           * Schema files legitimately use `sql\`...\`` for partial unique
           * index WHERE clauses (drizzle has no first-class helper for
           * those). Everything else stays in the default allowlist.
           */
          allowFiles: [
            "**/migrations/**",
            "**/raw/**",
            "**/health/**",
            "**/*.check.ts",
            "**/tests/**",
            "**/__tests__/**",
            "**/src/clients/postgres/schema/**",
          ],
        },
      ],
      "drizzle-conventions/no-nested-db-transaction": "error",
      "drizzle-conventions/schema-files-must-only-export-schema": "error",
      "drizzle-conventions/schema-files-must-not-import-driver": "error",
      /*
       * Account-scoped tables — every query must filter by `accountId`.
       * Keep this list in sync with the `// @account-scoped accountId`
       * tagged tables in src/clients/postgres/schema/*. Adding a new
       * tenant-bound table without listing it here is a tenant-isolation
       * bug waiting to happen.
       *
       * `alternateScopeColumns` whitelists narrower-than-accountId scopes
       * that are still safe:
       *   - userId on accountMemberships — a per-user membership listing
       *     (powers the account switcher) is bounded by the requesting
       *     user; cross-tenant by design.
       *   - tokenHash on accountInvitations — cryptographically unique;
       *     the row IS the scope (powers the accept-invitation flow).
       *
       * `allowFiles` covers files whose entire purpose is operating
       * across accounts (background sweeps, admin tooling).
       */
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

      /*
       * Stripe webhook path: src/api/billing/billing.routes.ts uses request.text();
       * billing.service.constructWebhookEvent uses constructEventAsync (Bun SubtleCrypto).
       *
       * The same rule family also guards the email-deliverability
       * webhooks under src/api/webhooks/. Those receivers verify
       * signatures via `verifyResendWebhook` (svix-HMAC) and
       * `verifySendGridWebhook` (ECDSA), so both names are added to
       * the recognised construct/verify list. The Stripe-flavoured
       * `whsec_` signature-source check is scoped to Stripe paths via
       * an override below — email providers manage their own keying.
       */
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
          // OAuth providers don't fit the noop-fallback pattern — when
          // credentials are missing, the route returns 404 rather than
          // falling through to a no-op provider.
          excludeProviderDirs: ["src/lib/oauth/providers"],
        },
      ],
      "resource-architecture/concern-import-boundaries": "error",
      "resource-architecture/no-cross-resource-internal-imports": "error",

      "module-boundaries/single-semantic-module": [
        "error",
        {
          // Strict: types, constants, and utils must each live in their
          // own file (auth.types.ts / auth.constants.ts / auth.utils.ts
          // pattern). Override the plugin's default `["type","constant"]`
          // allowance — we don't ship "domain primitive" combo files.
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

      // ---------------------------------------------------------------------
      // Structured logging — required `event:` field, masked PII, no
      // stringified errors. The template's getErrorMessage() walks the
      // cause chain; the plugin autofixes `String(error)` → that.
      // ---------------------------------------------------------------------
      "structured-logging/require-event-field": "error",
      "structured-logging/mask-pii-fields": [
        "error",
        {
          // The template ships maskEmailForLogging in src/lib/email/utils.
          // `redact` and `mask` cover ad-hoc cases.
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
        { extractorName: "getErrorMessage" },
      ],
      "structured-logging/typed-event-names": [
        "error",
        {
          eventNamesModule: "src/config/logger.events.ts",
          eventNamesExport: "LOG_EVENTS",
        },
      ],

      // ---------------------------------------------------------------------
      // Test conventions — no .only / fdescribe in committed code, tests
      // route DB through helpers, every test mirrors a source file.
      // ---------------------------------------------------------------------
      "test-conventions/no-focused-tests": "error",
      "test-conventions/no-direct-db-in-tests": [
        "error",
        {
          testFiles: ["tests/**/*.ts", "**/*.test.ts"],
          forbiddenPaths: ["**/clients/postgres/**", "drizzle-orm"],
          helpersPath: "tests/helpers/db",
        },
      ],
      "test-conventions/test-file-mirrors-source": "error",

      // ---------------------------------------------------------------------
      // Env access — every read goes through src/config/env, every key
      // must exist in the schema file.
      // ---------------------------------------------------------------------
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

      // ---------------------------------------------------------------------
      // Auth-cookie hardening + bcrypt floor.
      // ---------------------------------------------------------------------
      "jwt-cookies/auth-cookie-must-be-httponly": "error",
      "jwt-cookies/auth-cookie-must-be-secure-in-prod": "error",
      "jwt-cookies/bcrypt-rounds-min": ["error", { minRounds: 12 }],

      // ---------------------------------------------------------------------
      // Cache layer — TTL required, prefixed keys, helper-built keys.
      // ---------------------------------------------------------------------
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
      // Opt-in helper rule — wire helpers as the template adds them.
      "cache-keys/cache-key-from-helper": "off",

      // ---------------------------------------------------------------------
      // DB transactions — multi-write functions must be transactional;
      // inside a tx, writes use `tx`, not the outer `db`.
      // ---------------------------------------------------------------------
      "db-transactions/multi-write-must-be-transactional": "error",
      "db-transactions/transaction-uses-tx-not-db": "error",

      // ---------------------------------------------------------------------
      // Audit log — mutating service methods must record an audit event,
      // audit writes must be fire-and-forget, no PII in metadata.
      // ---------------------------------------------------------------------
      "audit-log/mutating-service-must-audit": [
        "error",
        {
          /*
           * Plugin default catches create/update/delete/insert/register/
           * approve/reject/activate/deactivate/enable/disable/complete/
           * cancel/grant/revoke. Extend with domain verbs we actually
           * use so a future `subscribe`/`accept`/`link` lands with an
           * audit trail by default.
           */
          mutatingPrefixes: [
            "^(create|update|delete|insert|register|approve|reject|activate|deactivate|enable|disable|complete|cancel|grant|revoke|subscribe|unsubscribe|accept|decline|link|unlink|reset|change|invite|leave|mark|rotate|switch)",
          ],
        },
      ],
      "audit-log/audit-write-must-be-fire-and-forget": [
        "error",
        { allowAwaitInsidePatterns: ["tests/**/*.ts"] },
      ],
      "audit-log/audit-metadata-no-pii": "error",

      // ---------------------------------------------------------------------
      // OAuth security — Redis-backed state, PKCE for OIDC, bounded TTL.
      // ---------------------------------------------------------------------
      "oauth-security/state-must-be-redis-backed": "error",
      "oauth-security/pkce-required-for-oidc": "error",
      "oauth-security/state-ttl-bounded": ["error", { maxTtlSeconds: 600 }],
    },
  },
  // -------------------------------------------------------------------------
  // AGENTS.md — resource layer imports (schemas / types / service / routes)
  // -------------------------------------------------------------------------
  {
    files: ["src/api/**/*.schemas.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "drizzle-orm",
              message:
                "*.schemas.ts is API validation only (AGENTS.md): do not import Drizzle.",
            },
          ],
          patterns: [
            {
              group: ["**/clients/postgres", "**/clients/postgres/**"],
              message:
                "*.schemas.ts must not import the DB client / schema (AGENTS.md). Use *.types.ts for Drizzle types.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/api/**/*.types.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "elysia",
              message:
                "*.types.ts must not import Elysia / TypeBox (AGENTS.md). Use *.schemas.ts for API shapes.",
            },
          ],
          patterns: [
            {
              group: ["@elysiajs/*"],
              message:
                "*.types.ts must not import Elysia plugins (AGENTS.md). Use *.schemas.ts for API shapes.",
            },
            {
              group: ["**/*.schemas", "**/*.schemas.ts"],
              message: "*.types.ts must not import *.schemas.ts (AGENTS.md).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/api/**/*.service.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "elysia",
              message:
                "*.service.ts is framework-agnostic (AGENTS.md): do not import Elysia.",
            },
          ],
          patterns: [
            {
              group: ["@elysiajs/*"],
              message:
                "*.service.ts is framework-agnostic (AGENTS.md): do not import Elysia plugins.",
            },
            {
              group: ["**/*.schemas", "**/*.schemas.ts"],
              message:
                "*.service.ts must not import *.schemas.ts — validation belongs in routes (AGENTS.md).",
            },
          ],
        },
      ],
      // Service files own a class + its singleton instance and nothing
      // else. Top-level helper functions belong in `<feature>.utils.ts`;
      // top-level constants in `<feature>.constants.ts`.
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
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "drizzle-orm",
              message:
                "*.routes.ts must not import Drizzle (AGENTS.md): delegate DB access to the service.",
            },
          ],
          patterns: [
            {
              group: ["**/clients/postgres", "**/clients/postgres/**"],
              message:
                "*.routes.ts must not import the DB client / schema (AGENTS.md): delegate to the service.",
            },
          ],
        },
      ],
      // Route files export the Elysia chain and nothing else. Top-level
      // helpers (param parsers, response shapers) belong in
      // `<feature>.utils.ts`; constants in `<feature>.constants.ts`.
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
    files: ["src/api/**/*.constants.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "elysia",
              message:
                "*.constants.ts should hold literals only (AGENTS.md): do not import Elysia here.",
            },
            {
              name: "drizzle-orm",
              message:
                "*.constants.ts should hold literals only (AGENTS.md): do not import Drizzle here.",
            },
          ],
          patterns: [
            {
              group: ["**/clients/postgres", "**/clients/postgres/**"],
              message:
                "*.constants.ts must not import the DB client / schema (AGENTS.md).",
            },
          ],
        },
      ],
    },
  },
  /*
   * acl.constants.ts is the single source of truth for role string values
   * (ROLE.owner = "owner", etc.). The src/** no-restricted-syntax role-literal
   * ban applies everywhere else; this file must keep the literals.
   */
  {
    files: ["src/lib/acl/acl.constants.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  /*
   * src/** gets the full no-restricted-syntax stack plus the role-literal ban.
   * acl.constants.ts is excluded above — see comment on that override.
   */
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
    // Tests can be a touch looser. Console is fine for diagnostics,
    // `no-restricted-syntax` for enums isn't useful here, and tests
    // legitimately throw `new Error(...)` to simulate retry/error paths
    // — `ApiErrors.*` would obscure the test's intent.
    files: ["tests/**/*.ts"],
    rules: {
      "no-console": "off",
      "elysia/no-direct-error-throw": "off",
      // Tests log free-form messages for diagnostics; the `event:`
      // requirement is for production observability.
      "structured-logging/require-event-field": "off",
      // Same reason — test logger calls don't go through LOG_EVENTS.
      "structured-logging/typed-event-names": "off",
      // Tests only audit the system under test; recording an audit event
      // from a fixture would muddy the assertions.
      "audit-log/mutating-service-must-audit": "off",
      // Likewise multi-write fixtures are common in integration tests.
      "db-transactions/multi-write-must-be-transactional": "off",
      // Test-time env overrides (e.g. `TEST_BASE_URL`) live in the
      // shell, not the validated boot schema, by design.
      "env-access/no-direct-process-env": "off",
      // Tests measure elapsed time, verify clock behaviour, and stamp
      // fixture timestamps — direct `Date.now()` / `new Date()` is the
      // right tool here. Production code routes through `nowMs()`.
      "code-flow/no-bare-date-now": "off",
    },
  },
  {
    // The env validator's own test legitimately mutates `process.env` to
    // exercise schema-validation failures. That is the entire point of
    // the suite.
    files: ["tests/config/env/**/*.ts"],
    rules: {
      "env-access/no-direct-process-env": "off",
    },
  },
  {
    // Cache-provider unit tests use bare keys / no TTL on purpose to
    // exercise the provider contract in isolation. The prefix + TTL
    // rules are about *production* cache writes routed through the
    // service layer.
    files: ["tests/lib/cache/**/*.ts"],
    rules: {
      "cache-keys/cache-key-must-be-prefixed": "off",
      "cache-keys/cache-set-must-have-ttl": "off",
    },
  },
  {
    // The audit-log service's own tests legitimately import the DB
    // client and assert on table state. The helpers indirection would
    // hide what the suite is actually verifying.
    files: ["tests/lib/audit-log/**/*.ts"],
    rules: {
      "test-conventions/no-direct-db-in-tests": "off",
    },
  },
  {
    // Cross-cutting parity tests + integration tests don't mirror a
    // single source file by design — they verify invariants that span
    // multiple modules.
    files: [
      "tests/auth/role-schema-parity.test.ts",
      "tests/health.test.ts",
      // The next three test specific concerns inside a multi-function
      // utils file (retry / validation in email.utils.ts; the
      // get-error-message helper inside errors.utils.ts). Combining
      // them would obscure each suite's assertions; per-concern test
      // files keep the suite navigable.
      "tests/lib/email/retry.test.ts",
      "tests/lib/email/validation.test.ts",
      "tests/lib/errors/get-error-message.test.ts",
      // Mirrors scripts/lint-meta/cli.ts, not src/.
      "tests/lint-meta/lint-meta.test.ts",
      // Mirrors scripts/codegen/acl-scaffold/edit-tuple.ts, not src/.
      "tests/scripts/acl-scaffold.test.ts",
    ],
    rules: {
      "test-conventions/test-file-mirrors-source": "off",
    },
  },
  {
    /*
     * The wall-clock util itself calls the underlying API. Same for tests
     * that intentionally exercise raw `new Date().toISOString()` shape.
     */
    files: ["src/lib/time/**/*.ts", "tests/lib/time/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // CLI scripts (scaffolders, build helpers) — console is the whole point.
    // They also throw plain `new Error(...)` for boot-time validation,
    // never reaching Elysia's onError handler.
    files: ["scripts/**/*.ts"],
    rules: {
      "no-console": "off",
      "elysia/no-direct-error-throw": "off",
      // Scripts crash the process on failure; the cause-chain extractor
      // is overkill there. A plain stringified error is the right shape
      // for one-shot CLI output.
      "structured-logging/no-error-stringify": "off",
    },
  },
  {
    /*
     * Email-deliverability webhooks (Resend / SendGrid) use their own
     * signature schemes — svix HMAC and ECDSA P-256 respectively — not
     * Stripe's `whsec_*` prefix or `stripe-signature` header. The
     * Stripe-webhook rule family encodes Stripe-specific verification
     * shape (constructEvent call inside the handler, the `whsec_`
     * literal scan, etc.), so it is disabled wholesale for this
     * directory. Signature handling here is verified by dedicated
     * unit tests against `verifyResendWebhook` and
     * `verifySendGridWebhook`.
     */
    files: [
      "src/api/webhooks/**/*.ts",
      "tests/api/webhooks/**/*.ts",
    ],
    rules: {
      "stripe-webhooks/require-stripe-signature-header": "off",
      "stripe-webhooks/handler-must-handle-event-type": "off",
      "stripe-webhooks/handler-must-be-idempotent": "off",
      "stripe-webhooks/handler-must-verify-signature": "off",
      "stripe-webhooks/no-parsed-body-before-verification": "off",
      "stripe-webhooks/service-must-construct-event": "off",
    },
  },
  /*
   * no-raw-role-literals.ts defines the role-literal scanner: it must mention
   * "owner"|"admin"|… in patterns and Set literals. lint:meta enforces the
   * ban in src/**; ESLint skips this one meta-lint file only.
   */
  {
    files: ["scripts/lint-meta/rules/source-text/no-raw-role-literals.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // Email template build/preview tools — same one-shot CLI semantics.
    files: ["src/templates/email/build.ts", "src/templates/email/preview.ts"],
    rules: {
      "structured-logging/no-error-stringify": "off",
      // The preview script reads PREVIEW_PORT directly — it's a dev-only
      // override knob, not a production env var that belongs in the
      // boot-validated singleton.
      "env-access/no-direct-process-env": "off",
    },
  },
  {
    // Boot-time validation + email-template build/preview tools. These
    // throws never reach the request-error handler — they crash the
    // process before Elysia is even constructed. Wrapping them in
    // `ApiErrors.*` would be misleading semantically.
    files: [
      "src/config/env/**/*.ts",
      "src/templates/email/build.ts",
      "src/templates/email/preview.ts",
    ],
    rules: {
      "elysia/no-direct-error-throw": "off",
    },
  },
  {
    // BillingService instantiates Stripe at construction. Eager
    // singleton would crash at import-time when BILLING_ENABLED=false
    // (no Stripe key). The lazy `getBillingService()` factory is the
    // correct pattern for env-gated services — but it surfaces as
    // class + module-scoped instance variable + factory function, which
    // the strict per-service-file `single-semantic-module` rejects.
    // Allow that specific combo here only.
    files: ["src/api/billing/billing.service.ts"],
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
    // Middleware + lib are framework code, not example product. They still
    // follow the common service/singleton and helper-module patterns used
    // across the template.
    files: ["src/middleware/**/*.ts", "src/lib/**/*.ts"],
    ignores: [
      "src/middleware/**/*.test.ts",
      "src/middleware/**/*.types.ts",
      "src/middleware/**/*.constants.ts",
      "src/lib/**/*.test.ts",
      "src/lib/**/*.types.ts",
      "src/lib/**/*.constants.ts",
    ],
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
    /*
     * Identifier-length floor for production source. Single-letter
     * names (`const c = new Redis(...)`) make grep useless and obscure
     * intent; the codebase contract is "every name spells out the
     * concept." Tests + scripts use shorthand fixture names
     * (`a, b` for two distinct accounts in an isolation test) so this
     * override is `src/`-only. Loop indexes (`i, j, k`) and unused
     * destructure (`_`) stay exempt because they're idiomatic.
     */
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
    // Cache providers store and return user-typed values. The `<T>`
    // generic is part of the public API; the only place to perform the
    // cast is at the storage boundary.
    files: ["src/lib/cache/providers/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-assertions": "off",
    },
  },
  {
    // Handlebars precompiled templates are evaluated via `new Function`
    // per the library's documented runtime pattern.
    files: ["src/lib/email/template.service.ts"],
    rules: {
      "@typescript-eslint/no-implied-eval": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  },
  {
    // Standalone CLIs run outside the request lifecycle and use console
    // for human output.
    files: ["src/templates/email/build.ts", "src/templates/email/preview.ts"],
    rules: {
      "no-console": "off",
    },
  }
);
