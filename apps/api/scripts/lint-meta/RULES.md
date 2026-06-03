# lint:meta rule catalog

Run `bun run lint:meta --list-rules` for the machine-readable list from the registry.

## Adding a rule

1. Pick a category folder under `scripts/lint-meta/rules/`.
2. Export an `IMetaRule` object with `id`, `category`, `description`, and `run(ctx)`.
3. Register it in `scripts/lint-meta/registry.ts`.
4. Run `bun run generate:lint-meta-docs` to refresh this file.
5. Add a test in `tests/lint-meta/` (fixture or temp dir — never commit invalid imports that break `tsc`).

## Rules

| Rule ID                                   | Category     | CI-critical | What it guards                                                                                                                                  |
| ----------------------------------------- | ------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `package-json-exact-deps`                 | supply-chain | no          | dependencies and devDependencies must use exact versions (no ranges).                                                                           |
| `no-overlapping-libs`                     | supply-chain | no          | package.json must not list forbidden overlapping library pairs.                                                                                 |
| `package-override-parity`                 | supply-chain | no          | package.json overrides must be reflected in the app's own bun.lock and mirrored by sibling apps that resolve the same package.                  |
| `shared-tool-version-parity`              | supply-chain | no          | Shared dev tooling (ESLint, TypeScript, Prettier, knip, …) must be pinned to the same version in every app that declares it.                    |
| `github-actions-permissions`              | ci           | no          | GitHub Actions workflows require permissions block and SHA-pinned uses: refs.                                                                   |
| `github-actions-permissions:verify`       | ci           | no          | Pinned action SHAs resolve on github.com (lint:meta:verify only).                                                                               |
| `github-actions-timeout-required`         | ci           | no          | GitHub Actions jobs require an explicit timeout-minutes (reusable-workflow calls exempt).                                                       |
| `github-actions-concurrency-explicit`     | ci           | no          | Workflows with a concurrency block must set cancel-in-progress explicitly.                                                                      |
| `github-actions-expression-syntax`        | ci           | no          | Every expression opener in a workflow must be a well-formed Actions expression.                                                                 |
| `github-actions-service-image-digest-pin` | ci           | no          | Workflow service/container images must be pinned by @sha256 digest, not tag alone.                                                              |
| `pre-push-ci-parity`                      | ci           | no          | CI workflow must include every command listed in scripts/ci/pre-push.manifest.json.                                                             |
| `engine-pin-parity`                       | ci           | no          | Bun version pin must stay aligned across package.json, Docker, and CI.                                                                          |
| `dockerfile-base-image-sha-pin`           | ci           | no          | Dockerfile base images must be pinned by @sha256 digest, not tag alone.                                                                         |
| `env-cascade-drift`                       | env          | no          | TypeBox env schema keys must align with .env.example documentation.                                                                             |
| `env-no-direct-process-env`               | env          | no          | Single entry point for env: every source file outside validate.ts must import the typed `env` object instead of reading `process.env` directly. |
| `generated-artifact-contract`             | artifacts    | no          | Sibling apps/ui generated ACL and OpenAPI files must carry required banner text.                                                                |
| `forbidden-text`                          | source-text  | no          | Source files must not contain inline lint/TS suppression comments.                                                                              |
| `no-inline-lint-disable`                  | source-text  | no          | Inline ESLint disables are not allowed.                                                                                                         |
| `no-ts-ignore`                            | source-text  | no          | TypeScript suppression comments are not allowed.                                                                                                |
| `canonical-helpers-single-home`           | source-text  | no          | Helpers in the canonical registry must only be declared in their single source-of-truth file.                                                   |
| `no-raw-role-literal`                     | source-text  | no          | Use ROLE.* from acl.constants.ts instead of raw owner/admin/member/viewer string literals.                                                      |
| `routes-require-test-sibling`             | testing      | no          | Route modules must ship with a matching HTTP-level test under tests/api/.                                                                       |
| `logic-files-require-test-sibling`        | testing      | no          | Logic modules must ship with a matching tests/**/*.test.ts sibling.                                                                             |
| `skipped-tests-need-tracking`             | testing      | no          | Skipped tests (.skip/.only/xit/xdescribe) must carry an issue URL or TODO(@owner) so the debt has a tracked owner.                              |
| `touch-tests-too`                         | testing      | no          | Modified logic/route files must include a matching test change (opt-in via LINT_META_TOUCHED_BASE).                                             |
| `eslint-config-no-warn`                   | config       | no          | ESLint severities must be "error" or "off", not "warn".                                                                                         |
| `eslint-override-paths-exist`             | config       | no          | Literal test-file paths in eslint.config.* overrides must exist on disk.                                                                        |
