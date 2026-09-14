# Testing

Read when writing tests, fixing failures, or wondering where a
new suite belongs.

| Suite       | Tool                                             | Where                                             |
| ----------- | ------------------------------------------------ | ------------------------------------------------- |
| Unit        | Vitest                                           | `src/**/*.test.{ts,tsx}` (mirror source location) |
| Integration | Vitest + hoisted `vi.mock` of `@/lib/api/client` | hooks / queries under `src/**`                    |
| Component   | Storybook `play` functions + `@storybook/test`   | `*.stories.tsx`                                   |
| E2E         | Playwright (Chromium + WebKit)                   | `e2e/`                                            |

Coverage threshold lives in `vitest.config.ts` and applies to the
current logic surface. New feature logic still needs focused tests
for utilities, stores, and query hooks.

## Lint enforces

- No `.only` / `fdescribe` committed.
- Every test file mirrors a source file
  (`test-conventions/test-file-mirrors-source`).

## Shared fixtures and translations

Keep cross-module fixtures and integration suites in `tests/`; the source-sibling
rule applies to colocated tests under `src/`. Use `tests/render-with-providers.tsx` to create a fresh QueryClient and i18next
instance per render. Pass explicit resources; never share caches across cases.
For translated assertions, use a fresh i18next instance with explicit resources
and locale in the wrapper. Importing the application's singleton config in one
fixture changes global translation state for other tests in the same process.

The pinned i18n lint plugin has a Bun patch for counted plural keys. It requires
an `_other` fallback (or `_ordinal_other` with `ordinal: true`) and a `count`
option; an uncounted missing base key still fails. The installed plugin regression
runs its actual ESLint entry point. Remove the patch only after a released plugin
passes that regression unmodified.

## Feature translation namespaces

`bun run new:feature Posts --i18n-namespace` creates `posts.json` in every locale,
uses `useNamespace("posts")` in the page, and adds a 10 KB gzip budget for the
namespace's locale chunks. The initial-route budget is unchanged. Generated
translations are English placeholders in every locale; translate them before shipping.

Namespace names match feature directories (`posts` → `src/features/posts`). ESLint
selects that feature's canonical English dictionary automatically; the unused-key
and locale-parity checks include every namespace. Keep shared shell copy in
`common.json`, and keep feature keys within the feature dictionary. The generator
still creates starter logic: register the route and implement/test the feature.

English `common` stays bundled so loading and error UI have a fallback. Other
locale dictionaries and feature namespaces load on demand. `useNamespace` suspends
under `I18nProvider` while loading and throws to the error boundary when neither
the requested locale nor a fallback dictionary is available. Plain i18next
`loadNamespaces()` resolves even on failure; inspect its callback/event rather
than interpreting a resolved promise as successful loading.
