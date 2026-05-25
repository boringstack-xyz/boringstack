---
name: build-feature
description: Use when implementing a new feature in ui-template — adding a page, scaffolding a component, building a vertical UI slice, wiring an existing API endpoint into the SPA, or creating a form. Drives the canonical loop — spec → plan → scaffold → tests-first → implement → `pnpm validate` → diff summary. Triggers — "add a feature", "add a page", "scaffold a component", "build [X] UI", "wire up [X] page", "add a route", "add the [X] screen", "new component", "new feature folder", "consume the /api/[X] endpoint".
---

# Build feature (ui-template)

You are implementing a new UI feature end-to-end. The loop has six checkpoints. Don't skip ahead — each step's output informs the next. The merge gate is `pnpm validate`; pre-1.0 rules apply (no `dark:` Tailwind classes, no `any`/`!`/`as`, no `dangerouslySetInnerHTML`, no `import.meta.env` outside `src/lib/env/`, no inline `eslint-disable`, no `console.*`).

## Checkpoint 1 — Spec

Ask the user (or restate from context) in this order:

1. **What is the feature?** One sentence.
2. **What kind?** Multiple OK for full-stack.
   - New page (route + feature folder + page component)
   - New shared component (`core/` or `global/`)
   - New feature-scoped component
   - Wiring an existing API endpoint into an existing page
   - Form (RHF + Zod)
   - List view fed by TanStack Query
3. **What does success look like?** User-visible behavior. Becomes test expectations in Checkpoint 4.
4. **Does this need a new endpoint?** If yes — run api-template's `/build-feature` first, regenerate the OpenAPI client via `pnpm openapi:types`, then come back here.

Print a one-line summary. Stop until the user confirms.

## Checkpoint 2 — Plan

Map the spec to scaffolders + glue points.

| Need                                                                                       | Command                                       |
| ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Feature folder (constants, schemas, types, queries, store, utils + starter Page component) | `pnpm new:feature <Name>`                     |
| Shared component (core/global)                                                             | `pnpm new:component <scope>/<Name>`           |
| Feature-scoped component                                                                   | `pnpm new:feature-component <feature>/<Name>` |

Print:

- Which scaffolder(s) will run, with exact arguments.
- Manual edits required — route registration in `src/app/router/routes.tsx`, nav entry, i18n keys in both `src/lib/i18n/locales/en/common.json` and `de/common.json`.
- Tests that will need writing — `lint:meta` requires a sibling test for every `*.{utils,queries,mutations,hooks,schemas,store,service}.{ts,tsx}` and component folder.

Stop. Get explicit user agreement before running anything.

## Checkpoint 3 — Scaffold

Run the scaffolder verbatim. Then:

```bash
git status -s
```

Print the new files. If a sibling is missing or the path looks off, STOP and surface it.

## Checkpoint 4 — Tests first

For every logic file from Checkpoint 3 (queries, mutations, hooks, utils, etc.) and every component folder, populate the `.test.ts` / `.test.tsx` sibling with assertions encoding Checkpoint 1's success criteria.

For components: Testing Library + Vitest. Test user-visible behavior, not implementation details.

Run only the new tests:

```bash
pnpm test:ci src/features/<feature> src/components/<scope>
```

Red is expected. Green means the test isn't actually exercising new behavior — fix the test before writing the implementation.

## Checkpoint 5 — Implement

Fill in JSX, hooks, queries, schemas. AGENT_CONTRACT.md / AGENTS.md rules that catch the most common slips:

- **Component anatomy**: 8 files in every folder (`.tsx`, `.hooks.ts`, `.types.ts`, `.constants.ts`, `.utils.ts`, `.stories.tsx`, `.test.tsx`, `index.ts`). The scaffolder enforces this; do not delete siblings.
- **Pure JSX**: no data computation inside JSX (lift `.map().filter()` into hooks), no inline arrow functions in attributes, no template literals in `className` (use `cn(...)`).
- **Theme**: never `dark:` Tailwind variants. Themed colors come from CSS custom properties under `:root[data-theme="dark"]` in `src/assets/css/tailwind.css`.
- **State**: server state lives in `*.queries.ts` (TanStack Query). Cross-page UI state in Zustand stores under `src/store/`. Feature-scoped state in `<feature>/<Feature>.store.ts`. Component-local state in `*.hooks.ts`. Never mix server + client state in one store.
- **API client**: only `@/lib/api/client.ts` may call `fetch`. Use `apiClient.GET("/api/<path>")` — paths come from the OpenAPI-typed client.
- **Forms**: RHF + Zod, with `applyServerErrors` mapping `ApiError.fieldErrors` to RHF field-level errors. Every form needs this.
- **i18n**: every user-visible string goes through `t("namespace.key")`. Add keys to BOTH `en/common.json` and `de/common.json`. Missing-key fallbacks aren't OK.
- **A11y**: jsx-a11y is the floor — labels on inputs, `role` + key handlers on interactive non-button elements, `aria-live` on status messages.
- **Auth tokens**: never written to localStorage. They live in HTTP-only cookies set by the API.

Re-run the new-file tests until green:

```bash
pnpm test:ci src/features/<feature>
```

## Checkpoint 6 — Verify

Full merge gate:

```bash
pnpm validate
```

That's `check → test:ci → build → size:check`. `check` itself = `lint + lint:meta + format:check + typecheck + knip`. Watch `size:check` for a bundle regression — if the new feature pushes a chunk over budget, lazy-load the page route via `React.lazy` + `Suspense`.

When `pnpm validate` is fully green:

```bash
git status -s
git diff --stat $(git merge-base HEAD origin/main)..HEAD
```

End with one of:

- ✓ "Feature `<name>` shipped. <N> files changed, <M> tests added. Ready to commit."
- ✗ "<step> failed; needs human attention before commit."

For non-trivial features (auth flows, payment flows, user-upload handling), mention `/security-review` as an optional pre-commit pass. Don't run it unless asked.

Do NOT run `git commit`, `git push`, or `gh pr create`. The user owns the commit boundary.
