# Shared packages (`packages/*`)

Read when code must be shared by more than one app, when adding a package under
`packages/`, or when the UI starts consuming one.

## Where shared code goes

Code used by two or more apps goes in `packages/<name>/`. Code used by one app
stays in that app. A package holds no secrets and no app-specific routes or
pages.

## Package shape

```
packages/<name>/
  package.json        "private": true, scripts below
  src/index.ts        public entry; everything else is internal
  tsconfig.json       extends ../../apps/ui/tsconfig.json
  eslint.config.mjs   imports the UI config (see below)
```

A package borrows the UI toolchain. Its lint, format and typecheck scripts run
the binaries installed in `apps/ui/node_modules`, so run `bun install` in
`apps/ui` first. A package with runtime dependencies of its own lists them in
its `package.json` and installs them itself.

## Required scripts

```json
{
  "lint": "bun ../../apps/ui/node_modules/eslint/bin/eslint.js --max-warnings=0 .",
  "format:check": "bun ../../apps/ui/node_modules/prettier/bin/prettier.cjs --check .",
  "typecheck": "bun ../../apps/ui/node_modules/typescript/bin/tsc -p tsconfig.json",
  "validate": "bun run lint && bun run typecheck && bun run format:check"
}
```

`validate` is the package gate. It is required. `--max-warnings=0` is required
on `lint`, so a warning fails the gate the same way an error does.

## Lint and tsconfig

`eslint.config.mjs` reuses the UI rule set, so the package is held to the same
architecture rules as the app:

```js
import uiConfig from "../../apps/ui/eslint.config.mjs";

export default [{ ignores: ["node_modules", "dist"] }, ...uiConfig];
```

The UI config's file globs (`src/**`) are relative to the UI directory, so a
package keeps its code under `src/` to match them. Turn off a UI rule in a
later block only when it cannot apply, and say why in a comment.

`tsconfig.json` extends the UI config and sets `"include": ["src/**/*.ts"]` with
`"noEmit": true`.

## Root wiring

- `scripts/stack-lib.sh` (`validate_packages`) runs `bun run validate` in every
  `packages/*/` that has a `package.json`. A package without a `validate` script
  fails the check.
- `scripts/stack-check.sh` runs that as the `packages validate` step of
  `bun run check`.
- `scripts/ci/pre-push.sh` runs it when anything under `packages/` changed.
- `.github/workflows/apps-ui-validate.yml` runs it on `packages/**` changes.

A product with no `packages/` directory gets no packages checks and no error.

## Consuming a package from `apps/ui`

Nothing in the UI build knows about packages until one is consumed. When the
first one is, add:

- `tsconfig.json`: a `paths` entry such as
  `"@/lib/<name>": ["../../packages/<name>/src/index.ts"]` (keep the `@/*` entry
  for `src/`), and the package's `src/**/*.ts` in `include`. Vitest reads these
  paths through `tsconfigPaths: true`, so tests resolve the same way.
- `vite.config.ts`, `server.fs.allow`: add `"../../packages"`. Without it the dev
  server refuses to serve files outside `apps/ui`.
- `vite.config.ts`, `resolve.dedupe`: list every dependency that both the app and
  the package declare (for example `zod`), so the bundle carries one copy.

## Images and dev containers

An app image or dev container sees only its own directory unless the packages
are passed in. The template wires them in as follows, so a package import works
the same in tests, dev containers and prod images.

- **Layout.** Apps sit two levels below the repo root (`apps/<app>`), so the
  relative path `../../packages/<name>` resolves from the app's `/app` to
  `/packages/<name>` inside a container. The prod images copy the packages to
  `/packages`, and the dev containers mount them there.
- **Prod images.** `apps/api/Dockerfile.prod` and `apps/ui/Dockerfile.prod`
  take `packages/` as the BuildKit named context `packages`
  (`COPY --from=packages . /packages`). Each package with a `package.json`
  then runs `bun install --production` in its own directory, so its runtime
  dependencies resolve from inside the package. Needs BuildKit, the default
  since Docker 23.
- **Build from an app directory** (for example to check an image by hand):

  ```bash
  cd apps/ui
  docker build --build-context packages=../../packages -f Dockerfile.prod .
  ```

  Compose (`additional_contexts`), `docker/build-push-action`
  (`build-contexts`) and the release workflows already pass this context.

- **Dev containers.** `api-dev`, `api-migrate-dev` and `ui-dev` mount
  `packages/` read-only at `/packages`. Run `bun install` inside a package that
  has runtime dependencies, on the host, before the containers start. The
  mount carries the package's `node_modules` with it.
- **Triggers.** The API and UI CI, the release workflows, the compose gate and
  the UI bundle diff all run when `packages/**` changes.
- `packages/README.md` keeps the directory present in a fresh checkout. It is
  a file, not a package, so it is not validated.

## Known gaps

- `lint:meta` scans only `src/`, `tests/`, `e2e/` and `.storybook/`
  (`scripts/lint-meta/context.ts`). Its architecture rules do not run on
  `packages/`. The package's own ESLint config is the only architecture gate
  there.
- The bundle budget gate (`check:size-budget`) covers `apps/ui` output only.
