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
