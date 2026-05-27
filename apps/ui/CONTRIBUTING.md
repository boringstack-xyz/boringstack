# Contributing

This template assumes most code is written by AI agents. The conventions
exist so `bun run validate` is a reliable signal — if the merge gate is green,
the code is shippable.

## Setup

```bash
nvm use            # respect .nvmrc
bun install
cp .env.example .env.local
bun run dev           # http://localhost:7331
```

## Add a component

```bash
bun run new:component core/Card
```

Creates `src/components/core/Card/` with all 8 files filled with stubs.
Edit, then:

```bash
bun run check          # lint + format + typecheck
bun run test           # vitest
bun run storybook      # see it in :6006
```

## Add a feature

```bash
bun run new:feature Widgets
```

Creates `src/features/widgets/` with all dot-suffix files and a starter
`WidgetsPage` component. The script refuses to overwrite existing files and
prints the remaining route + i18n wiring steps.

Then:

1. Define endpoints + query keys in `Widgets.constants.ts`.
2. Define request/response shapes in `Widgets.schemas.ts`.
3. Derive types via `z.infer` in `Widgets.types.ts`.
4. Write query hooks in `Widgets.queries.ts`.
5. Add component(s) under `components/<Name>/`.
6. Register the route in `src/app/router/routes.tsx`.
7. Add `features.widgets.*` copy to every locale JSON file.

## Add a shadcn primitive

```bash
bun run ui:add button input dialog
```

Wires it into `src/components/ui/` (shadcn's flat convention). Compose on
top of it in `src/components/core/<Name>/` (our 8-file anatomy).

## The validate contract

```bash
bun run validate
```

= lint clean + format clean + typecheck + Vitest green + Playwright green +
production build green + bundle-size budgets pass.

Never run `--no-verify`. Never silence with `eslint-disable`. If a rule is
wrong, change the rule config.

## Visual regression (local only)

```bash
bun run e2e:visual          # compare against your committed-locally baselines
bun run e2e:visual:update   # accept current rendering as the new baseline
```

Baselines are platform-specific (font hinting + anti-aliasing differ between
macOS and Linux) so they're **not committed** — see `.gitignore`. Each
developer keeps their own baselines locally. CI does **not** run visual
regression; getting it CI-stable requires Docker-rendered baselines, which
is intentionally out of scope for v0.1.

When a visual change is intentional, run `bun run e2e:visual:update` to refresh
your local baselines and continue.

## Lighthouse (a11y / perf / SEO budgets)

```bash
bun run lighthouse
```

Builds, serves `dist/` via `vite preview`, and runs Lighthouse against
`/login` and the 404 page. CI runs this on every PR and fails on regression.
Reports land in `.lighthouseci/` and are uploaded as a workflow artifact.

## What to test

| Layer          | Test                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| `*.utils.ts`   | Vitest unit, table of edge cases                                          |
| `*.schemas.ts` | Vitest unit, valid + invalid fixtures                                     |
| `*.store.ts`   | Vitest, exercise every action                                             |
| `*.queries.ts` | Vitest with `vi.mock("@/lib/api/client")`, happy + 401 + 500 + network    |
| `*.tsx`        | Storybook story (`Default` + variants), a `play` function for interaction |
| Page-level     | Playwright E2E covering the critical path                                 |

## Commit hygiene

- Conventional Commits encouraged (`feat:`, `fix:`, `chore:`).
- One PR per coherent change. If it touches >5 features, split it.
- PR description includes a filled-out [AGENT_REVIEW.md](AGENT_REVIEW.md)
  section.
