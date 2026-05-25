# apps/ui scripts

Grouped by purpose. Prefer `bun run` commands over calling files directly.

When you add a `package.json` script that runs a file under `scripts/`, update this README and run `bun run check:scripts-docs`. After changing lint-meta rules, run `bun run generate:lint-meta-docs`. Refresh boringstack.xyz catalogs from `.github` with `bun run generate:docs-data`.

## Folders

| Folder                     | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| [`ci/`](ci/)               | Pre-push gate, CI manifest                              |
| [`dev/`](dev/)             | Local developer workflow guards                         |
| [`codegen/`](codegen/)     | Scaffolding and OpenAPI contract generation             |
| [`quality/`](quality/)     | Test and bundle adjunct checks outside ESLint           |
| [`lint-meta/`](lint-meta/) | Static meta-lint rules ([RULES.md](lint-meta/RULES.md)) |

## Command map

| bun run command                    | Script                                         |
| ---------------------------------- | ---------------------------------------------- |
| `bun run dev`                      | `dev/preflight-host-dev.sh` (then Vite)        |
| `bun run pre-push`                 | `ci/pre-push.sh`                               |
| `bun run lint:meta`                | `lint-meta/cli.ts`                             |
| `bun run lint:meta:verify`         | `lint-meta/cli.ts --verify`                    |
| `bun run generate:lint-meta-docs`  | `lint-meta/generate-rules-md.ts`               |
| `bun run test:ci`                  | `quality/run-tests-clean.ts`                   |
| `bun run size:check:modulepreload` | `quality/check-modulepreload-size-coverage.ts` |
| `bun run generate:api`             | `codegen/generate-api.ts`                      |
| `bun run generate:api:check`       | `codegen/generate-api.ts --check`              |
| `bun run new:component`            | `codegen/new-component.ts`                     |
| `bun run new:feature`              | `codegen/new-feature.ts`                       |

## Maintainer

| bun run command                   | Script                                   |
| --------------------------------- | ---------------------------------------- |
| `bun run generate:lint-meta-docs` | `lint-meta/generate-rules-md.ts`         |
| `bun run check:lint-meta-docs`    | `lint-meta/generate-rules-md.ts --check` |
| `bun run check:scripts-docs`      | `check-scripts-docs.ts`                  |

## Manual / operator

See the monorepo root `scripts/audit-repo-settings.sh` to audit GitHub repo
settings drift against `.github/desired-repo-settings.json`.
