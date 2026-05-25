# apps/api scripts

Grouped by purpose. Prefer `bun run` commands over calling files directly.

When you add a `package.json` script that runs a file under `scripts/`, update this README and run `bun run check:scripts-docs`. After changing lint-meta rules, run `bun run generate:lint-meta-docs`. Refresh boringstack.xyz catalogs from `.github` with `bun run generate:docs-data`.

## Folders

| Folder                     | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| [`ci/`](ci/)               | Pre-push gate, CI manifest                              |
| [`dev/`](dev/)             | Local developer workflow guards                         |
| [`codegen/`](codegen/)     | Scaffolding, ACL type sync, VAPID key generation        |
| [`db/`](db/)               | Database seed utilities                                 |
| [`quality/`](quality/)     | Test and coverage adjunct checks outside ESLint         |
| [`lint-meta/`](lint-meta/) | Static meta-lint rules ([RULES.md](lint-meta/RULES.md)) |

## Command map

| bun command                  | Script                                         |
| ---------------------------- | ---------------------------------------------- |
| `bun run dev`                | `dev/preflight-host-dev.sh` (then Bun watch)   |
| `bun run pre-push`           | `ci/pre-push.sh`                               |
| `bun run lint:meta`          | `lint-meta/cli.ts`                             |
| `bun run lint:meta:verify`   | `lint-meta/cli.ts --verify`                    |
| `bun run generate:lint-meta-docs` | `lint-meta/generate-rules-md.ts`          |
| `bun run test`               | `quality/run-tests-clean.ts`                   |
| `bun run test:coverage`      | `quality/check-coverage.ts`                    |
| `bun run db:seed`            | `db/seed-superuser.ts`                         |
| `bun run generate:acl-types` | `codegen/generate-acl-types.ts`                |
| `bun run generate:acl-types:check` | `codegen/generate-acl-types.ts --check`    |
| `bun run vapid:generate`     | `codegen/vapid-generate.ts`                    |
| `bun run new:resource`       | `codegen/new-resource.ts`                      |
| `bun run new:feature`        | `codegen/new-feature.ts`                       |
| `bun run new:action`         | `codegen/new-action.ts`                        |
| `bun run new:role`           | `codegen/new-role.ts`                          |
| `bun run new:subject`        | `codegen/new-subject.ts`                       |
| `bun run new:notification-event` | `codegen/new-notification-event.ts`        |

## Maintainer

| bun command                         | Script                                   |
| ----------------------------------- | ---------------------------------------- |
| `bun run generate:lint-meta-docs`   | `lint-meta/generate-rules-md.ts`         |
| `bun run check:lint-meta-docs`      | `lint-meta/generate-rules-md.ts --check` |
| `bun run check:scripts-docs`        | `check-scripts-docs.ts`                  |

## Manual / operator

See the monorepo root `scripts/audit-repo-settings.sh` to audit GitHub repo
settings drift against `.github/desired-repo-settings.json`.
