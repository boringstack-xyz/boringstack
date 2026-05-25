# ui-template scripts

Grouped by purpose. Prefer `pnpm` commands over calling files directly.

When you add a `package.json` script that runs a file under `scripts/`, update this README and run `pnpm check:scripts-docs`. After changing lint-meta rules, run `pnpm generate:lint-meta-docs`. Refresh boringstack.xyz catalogs from `.github` with `pnpm generate:docs-data`.

## Folders

| Folder                     | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| [`ci/`](ci/)               | Pre-push gate, CI manifest, GitHub settings audit       |
| [`dev/`](dev/)             | Local developer workflow guards                         |
| [`codegen/`](codegen/)     | Scaffolding and OpenAPI contract generation             |
| [`quality/`](quality/)     | Test and bundle adjunct checks outside ESLint           |
| [`lint-meta/`](lint-meta/) | Static meta-lint rules ([RULES.md](lint-meta/RULES.md)) |

## Command map

| pnpm command                    | Script                                         |
| ------------------------------- | ---------------------------------------------- |
| `pnpm dev`                      | `dev/preflight-host-dev.sh` (then Vite)        |
| `pnpm pre-push`                 | `ci/pre-push.sh`                               |
| `pnpm lint:meta`                | `lint-meta/cli.ts`                             |
| `pnpm lint:meta:verify`         | `lint-meta/cli.ts --verify`                    |
| `pnpm generate:lint-meta-docs`  | `lint-meta/generate-rules-md.ts`               |
| `pnpm test:ci`                  | `quality/run-tests-clean.ts`                   |
| `pnpm size:check:modulepreload` | `quality/check-modulepreload-size-coverage.ts` |
| `pnpm generate:api`             | `codegen/generate-api.ts`                      |
| `pnpm generate:api:check`       | `codegen/generate-api.ts --check`              |
| `pnpm new:component`            | `codegen/new-component.ts`                     |
| `pnpm new:feature`              | `codegen/new-feature.ts`                       |

## Maintainer

| pnpm command                   | Script                                   |
| ------------------------------ | ---------------------------------------- |
| `pnpm generate:lint-meta-docs` | `lint-meta/generate-rules-md.ts`         |
| `pnpm check:lint-meta-docs`    | `lint-meta/generate-rules-md.ts --check` |
| `pnpm check:scripts-docs`      | `check-scripts-docs.ts`                  |

## Manual / operator

| Task                             | Script                      |
| -------------------------------- | --------------------------- |
| Audit GitHub repo settings drift | `ci/audit-repo-settings.sh` |
