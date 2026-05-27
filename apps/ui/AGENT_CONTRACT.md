# Agent contract

Read this first. Everything below is enforced by `bun run validate`.

## Merge bar

```
bun run validate
```

= lint clean + format clean + typecheck clean + Vitest green + production build green + bundle size within budget.

Playwright (e2e) runs in `infra-compose-full-stack-smoke.yml` against a real booted stack; it is a required monorepo check but not part of `bun run validate`. To run e2e locally against a stack you have running, use `bun run validate:full`.

Hard rules:

- No `eslint-disable`. If a rule is wrong, fix the code or add a scoped rule
  override in `eslint.config.mjs` — never silence inline.
- No `any`. Use `unknown` and narrow.
- No `!` non-null assertion.
- No blind `as` casts. `as const`, shadcn-owned primitives, tests, and small
  typed parser boundaries are allowed when the value is validated or isolated.
- No `console.*`. Use `logger.{debug,info,warn,error}({ event, ... })`.
- No raw `fetch` outside `src/lib/api/openapi.ts`.
- No raw runtime env reads in `src/**` outside `src/lib/env/`.
- No hardcoded user-facing strings in JSX. Translate with `t("…")`.
- No `dark:` Tailwind classes. Theme switching is driven by CSS custom
  properties under `:root[data-theme="dark"]`, not the `dark:` variant.
  After `bun run ui:add <primitive>`, strip the `dark:` classes the scaffolder
  emits — they're dead code under this theme model.

## Commands

| Command                        | What it does                                                           |
| ------------------------------ | ---------------------------------------------------------------------- |
| `bun run dev`                  | Vite dev server on :7331 (proxies `/api` and `/auth` → `VITE_API_URL`) |
| `bun run validate`             | Merge gate: lint + format + typecheck + vitest + build + size budget   |
| `bun run validate:full`        | `validate` + Playwright (needs a running stack on :7331)               |
| `bun run check`                | Lint + format + typecheck (no tests)                                   |
| `bun run test`                 | Vitest in watch mode                                                   |
| `bun run test:ci`              | Vitest single run with coverage                                        |
| `bun run e2e`                  | Playwright (Chromium + WebKit)                                         |
| `bun run storybook`            | Storybook on :6006                                                     |
| `bun run ui:add <name>`        | Add a shadcn/ui primitive                                              |
| `bun run new:component <path>` | Scaffold a component folder with all suffixes                          |
| `bun run new:feature <Name>`   | Scaffold a feature folder + starter page; prints route/i18n next steps |

## Feature folder layout

```
src/features/<feature>/
├── <Feature>.queries.ts     # TanStack Query hooks
├── <Feature>.store.ts       # Zustand (optional)
├── <Feature>.schemas.ts     # Zod
├── <Feature>.types.ts       # z.infer types
├── <Feature>.constants.ts   # Query keys, endpoints (literals only)
├── <Feature>.utils.ts       # Pure helpers
└── components/<ComponentName>/   # 8-file anatomy (below)
```

## Component anatomy

```
<ComponentName>/
├── <ComponentName>.tsx        # Pure JSX. No useState/useEffect.
├── <ComponentName>.hooks.ts   # All state, effects, callbacks.
├── <ComponentName>.types.ts   # IComponentNameProps + view types.
├── <ComponentName>.constants.ts
├── <ComponentName>.stories.tsx  # Must export `Default`.
├── <ComponentName>.test.tsx
└── index.ts                   # `export { default as <Name> } from "./<Name>";`
```

Exception: `src/components/ui/**` is shadcn territory — flat single-file
components, lint-exempt.

## Import boundary table (enforced by ESLint)

| File suffix         | May import                                                                                    | May NOT import                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `*.tsx` (component) | `./*.hooks`, `./*.types`, `./*.constants`, `./*.utils`, `@/lib/classnames`, `@/components/**` | `@tanstack/react-query`, `zustand`, `react-router-dom`, `*.queries`, `*.store`, raw `fetch`, `axios` |
| `*.hooks.ts`        | TanStack Query, Zustand, `*.queries`, `*.store`, `@/lib/**`, `react-router-dom`               | JSX                                                                                                  |
| `*.queries.ts`      | `@/lib/api/client`, `@tanstack/react-query`, `*.schemas`, `*.types`                           | Components, JSX, Zustand                                                                             |
| `*.store.ts`        | `zustand`, `*.types`, `*.schemas`                                                             | Components, TanStack Query, JSX                                                                      |
| `*.schemas.ts`      | `zod`                                                                                         | Anything else                                                                                        |
| `*.types.ts`        | `*.schemas` (`z.infer`), other `.types`                                                       | Runtime code                                                                                         |
| `*.constants.ts`    | nothing                                                                                       | everything                                                                                           |
| `*.routes.tsx`      | `react-router-dom`, lazy-imported pages                                                       | direct query/store imports                                                                           |
| `src/lib/env/**`    | `zod`, `import.meta.env`                                                                      | (only this folder reads env)                                                                         |

## ESLint plugin map

Standard: `@eslint/js`, `typescript-eslint`, `eslint-plugin-react`,
`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`,
`eslint-plugin-jsx-a11y`, `eslint-plugin-import`, `eslint-plugin-promise`,
`eslint-plugin-sonarjs`, `eslint-plugin-unicorn`, `eslint-config-prettier`.

Custom — published from
[`boringstack-xyz/eslint-plugins`](https://github.com/boringstack-xyz/eslint-plugins)
to npm under the
[`@boring-stack-pkg`](https://www.npmjs.com/org/boring-stack-pkg) scope and
installed as ordinary semver-pinned `devDependencies` in `package.json`:

| Plugin                                                         | Enforces                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `@boring-stack-pkg/eslint-plugin-module-boundaries`            | The import-boundary table above                                                      |
| `@boring-stack-pkg/eslint-plugin-resource-architecture`        | Feature-folder + component-folder shape                                              |
| `@boring-stack-pkg/eslint-plugin-test-conventions`             | No `.only`, tests mirror source                                                      |
| `scripts/lint-meta/` ([RULES.md](scripts/lint-meta/RULES.md))  | Static repo guardrails: source-text bans, CI parity, env cascade, cross-repo imports |
| `@boring-stack-pkg/eslint-plugin-structured-logging`           | `logger.*({ event, ... })`, no console, no PII                                       |
| `@boring-stack-pkg/eslint-plugin-env-access`                   | `import.meta.env` only in `src/lib/env/`                                             |
| `@boring-stack-pkg/eslint-plugin-react-component-architecture` | 15 rules from AGENTS.md (state-in-hooks, classNames, no dark:, IProps, etc.)         |
| `@boring-stack-pkg/eslint-plugin-code-flow`                    | Control-flow and async discipline (see plugin README)                                |
| `@boring-stack-pkg/eslint-plugin-i18n-keys`                    | Static `t("…")` keys exist in `en/common.json` (and siblings)                        |
| `@boring-stack-pkg/eslint-plugin-tanstack-query-cache`         | `*.queries.ts`: prefix keys vs `setQueriesData` / matcher APIs                       |

## Quick pointers

- HTTP types come from the **OpenAPI contract**. `src/lib/api/schema.d.ts` is
  generated from `${VITE_API_URL}/swagger/json` via `bun run generate:api` —
  never edit by hand. `apiClient.GET("/auth/me")` infers the response type
  from this file. Regenerate whenever the API changes.
- Add a server-state hook → `*.queries.ts` (TanStack Query). Component imports it through `*.hooks.ts`, never directly.
- Add UI state → `*.store.ts` (Zustand) or local `useState` inside `*.hooks.ts`.
- Add a form → react-hook-form + Zod (`zodResolver`). Server errors mapped via `applyServerErrors` in `@/features/auth/Auth.utils.ts`.
- Log an event → `logger.info({ event: "namespace.event_name", ...payload })`.
- Translate a string → wrap in `t("…")`. Add the key to `src/lib/i18n/locales/en/common.json`.
- Need a shadcn primitive → `bun run ui:add <name>`.
- Need a new component → `bun run new:component <core|global>/<Name>`.
- Need a new feature → `bun run new:feature <Name>`.
- Add a lint-meta rule → implement `IMetaRule` under `scripts/lint-meta/rules/<category>/`, register in `registry.ts`, run `bun run generate:lint-meta-docs`, test in `tests/lint-meta/`, then refresh boringstack docs data via `.github` `bun run generate:docs-data`.
