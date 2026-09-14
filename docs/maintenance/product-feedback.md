# Product feedback acceptance ledger

Source: the Tinkercaster build report supplied on 2026-09-14. These are reported
observations, not automatically accepted diagnoses or instructions. Status stays
open until a reproduction, correction or documented scope decision is recorded.
Product-specific examples need a minimal fixture before changing template policy.

The implementation order is infrastructure and trustworthy checks, fresh-product
setup, then feature tooling. Validation uses disposable fixtures, not another
agent-built product. Existing security and coverage gates remain enforced.

| Report | Observation | Status / evidence |
| --- | --- | --- |
| 1 | Root-owned files in the bind-mounted source tree. | Implemented: setup creates host mount directories; email output uses a named volume. Setup fixture and Compose guardrails. Existing ownership is not silently repaired. |
| 2 | Fresh scaffold fails `format:check`. | Addressed: rename prints explicit app formatting commands; no claim that textual replacement preserves formatting. |
| 3 | Leftover template dev stack holds the ports. | Implemented: no-boot preflight warns on occupied core ports when lsof is available; never stops another project. |
| 4 | Host `bun install` silently breaks the running `ui-dev` container. | Documented: UI development guide gives restart and dependency-volume refresh commands through the Compose wrapper. |
| 5 | Time-to-first-feature. | Partial: executable stripped-checkout, rename, setup and installer regressions; no measured ten-minute guarantee. |
| 6 | No way to set env toggles through the installer. | Implemented: installer --env-file overlays defaults before boot, protects existing files, withholds values and writes mode 0600; regression includes refusal control. |
| 7 | Bun version pin vs. docs. | Addressed: installer and public agent page show the exact pinned Bun installation command. |
| 8 | `setup.sh --up` prints OSC-8 hyperlinks | Implemented: captured setup output contains plain URLs; regression exercises setup --up with a disposable launcher. |
| 9 | knip hint on a fresh checkout | Implemented: removed the stale setup-test-env knip ignore; API check must remain clean. |
| 10 | Rename rewrites the template's own marketing into the product. | Implemented: first rename creates product README, removes marked template onboarding and preserves agent policies; rerun preserves edited README. |
| 11 | Stripping `apps/docs` is a manual multi-file job. | Implemented: preview-first strip-docs removes the site, docs-only workflows and Dependabot entry; optional installer CI and tooling guards; remote required checks still require inspection. |
| 27 | `bun run ui:add <component>` assumes a `shadcn` binary that isn't there. | Implemented: shadcn 4.21.0 is an exact dev dependency with a lockfile, published beyond the cooldown. |
| 28 | jsdom has no `ResizeObserver`; Radix primitives need one. | Implemented: shared ResizeObserver lifecycle stub; documentation reserves layout claims for Playwright. |
| 29 | Feature-page size budgets are set for demo-sized pages. | Policy retained: route budgets remain reviewed per feature; no blanket increase to 25 KB. |
| 30 | `bun test` at the api root runs the infra-gated security spec. | Addressed: API contract and validation guide specify bun run test, separate from security specs. |
| 31 | The agent runtime migrates but never seeds. | Implemented: db:prepare runs migrations then the seed hook in owned runtimes and production; product reference seeds must be idempotent. |
| 32 | `agent:verify --profile=feature` takes ~5 minutes and is strictly serial. | Partial: human verification output includes durations. Stateful lanes remain serial; parallelization needs isolation evidence. |
| 33 | Local `bun run test` silently skips every database test. | Implemented: explicitly requested unreachable DB fails; unconfigured unit-only runs remain distinct. Regression rejects old silent return. |
| 34 | `docker compose -p <project> run …` outside `dev.sh` silently recreates the dev stack. | Documented: use infra/compose/compose/dev.sh for project/overlay consistency. |
| 35 | Component anatomy vs. real pages: the `single-semantic-module` rule fights every non-trivial file. | Needs failing module examples to distinguish parser defects from intended file boundaries. |
| 36 | `no-cross-feature-imports` allow-list is the only way to consume `useMe`. | Needs product import example and a review of which session interface belongs in a shared public module. |
| 37 | TypeBox literal unions from `.map()` silently become `undefined`. | Needs original TypeBox union and OpenAPI output fixture. |
| 38 | `smallint`/`integer` columns arrive in the OpenAPI client as `string / number`. | Needs original nested integer schema and generated-client consumer. |
| 39 | `account-scoped-tables-require-where` has no story for public-by-token lookups. | Security design required: public token resolution must establish account scope at a reviewed boundary; no tenant-query exemption added. |
| 40 | `no-raw-sql-outside-allowlist` blocks the standard Drizzle increment. | Implemented upstream: `eslint-plugin-drizzle-conventions` 0.2.0 accepts templates whose text is only arithmetic around column references (`sql\`${col} + 1\``); anything else stays reported (boringstack-xyz/eslint-plugins#15). Drizzle guide names the accepted shape. |
| 41 | `resource-architecture/no-cross-resource-internal-imports` needs a "public surface" convention that the generator scaffolds. | Implemented: account-resource generator emits a public index.ts for service and types; generated routes consume it and generator validation checks it. |
| 42 | New queue = five touch points the docs don't list. | Addressed: queue guides enumerate exports, setup, manager, producer, tests and configuration registrations with actual paths. |
| 12 | Rebranding the theme trips the 12 KB CSS budget. | Policy retained: measure the stylesheet and review an intentional budget change; do not raise every product budget from one report. |
| 13 | Generated feature scaffolding is heavier than a static page needs. | Needs product fixture: identify the unnecessary generated files on a static-page example before adding another generator mode. |
| 14 | Component tests need an i18n strategy hint. | Documented: isolated i18next instances and provider caches in UI testing guide. |
| 15 | First `git push` fails on missing local security tooling. | Implemented: required security scanners are discovered before scans start. |
| 16 | Stripping `apps/docs` and gitleaks history scanning interact badly. | Addressed: stripping deliberately preserves historical secret exceptions; no file-wide allowlist added. |
| 17 | Dev database (`db:push --force`) vs. push gate (`db:migrate`) contradict each other. | Documented: dev schema push does not validate committed migration history; owned runtime and production use migrations. |
| 18 | Pre-push gate ordering hides the cheap failure behind the expensive passes. | Implemented: aggregate scanner availability preflight precedes expensive scans. |
| 19 | `i18n-locale-keys-used` does not understand i18next plural suffixes. | Implemented: locale-use rule recognizes CLDR cardinal and ordinal suffixes; positive and unused-key controls. |
| 20 | `sonarjs/cognitive-complexity` at 20 punishes page components with loading/error/empty/ready branches. | Policy retained: loading/error/empty states do not justify a blanket complexity increase. Need the component to assess extraction. |
| 21 | `module-boundaries/single-semantic-module` forbids a render helper next to a component. | Needs minimal source fixture in the shared architecture plugin; no broad local exemption introduced. |
| 22 | `test-conventions` mirror rule vs. shared fixtures. | Documented: cross-module fixtures belong in tests/, colocated src tests mirror their module. |
| 23 | Relational query typing. | Needs original schema/query fixture to distinguish a Drizzle typing defect from usage. |
| 24 | TypeBox `t.Tuple` vs. openapi-fetch. | Needs original tuple schema and generated-client consumer; no schema weakening. |
| 25 | Locale JSON lives in the cold-start bundle. | Implemented: lazy locale backend, namespace-aware feature generation and linting, per-namespace budget. Disposable generated-page test and build verify namespace copy is outside initial chunks; English common remains bundled for fallback. |
| 26 | Cache generation is invalidated by nobody. | Needs original cache key, mutation and invalidation path; generator mutations already have deterministic cache probes. |
| 43 | Two header components is one too many; the template ships a static public header and a session-aware app nav, and nothing says which to use where. | Needs product route/navigation example; no automatic deletion of public or authenticated navigation. |
| 44 | The modulepreload budget gate lists asset chunks by hand, so any new shared import on the cold path fails `validate` with a filename. | Policy retained: cold-path imports remain budgeted and reviewed; a new shared dependency is not automatically free. |
| 45 | `lint:meta` `i18n-locale-keys-used` is excellent, but deleting a component leaves its keys behind with no pointer to the deleting change. | Existing unused-key diagnostic retained; plural false positives corrected. |
| 46 | Playwright `fullyParallel` + one shared per-worker user made two "green" specs order-dependent. | Documented: mutating browser tests need independent authenticated fixtures; product order-dependence needs its specs. |
| 47 | A real product bug hid behind a "flaky" test: share dialog opened before the list query settled and never created a link. | Product defect: requires the actual dialog and query lifecycle; do not transplant a generic effect. |
| 48 | All locale copy is eager: one JSON per language in the cold-start bundle, and nothing in the template shows how to lazy-load a namespace. | Implemented: namespace loading, generation, canonical-dictionary lint selection, all-namespace unused-key/parity checks and bundle separation (25). |
| 49 | `eslint --cache` does not invalidate on the i18n dictionary. | Implemented: the cache stays on; the ESLint config carries a digest of every English dictionary in `settings`, so ESLint's per-file config hash, and with it the cached result, changes with the dictionaries. Regression proves a deleted key is reported on the cached rerun and hidden without the digest. |
| 50 | `stories-require-default-export` wants a story literally named `Default`. | Already explicit in installed plugin: diagnostic requires export const Default or export { Default }; keep named variants and add an alias when appropriate. |
| 51 | The single-semantic-module rule pushes even a two-line filter object out of a hook file. | Needs a shared-rule fixture for private literal constants; no broad architecture exemption. |
| 52 | Wins worth keeping. | Preserve: reported win; no corrective change requested. |
| 53 | Vite's dev server served a stale module graph after a burst of renames and the error was misleading. | Addressed: wrapper already forwards restart; docs specify ui-dev and stale-graph symptoms. |
| 54 | Template features nobody asked for cost real review time: the second locale and the dark theme. | Product preference: retain existing locale/theme defaults; optional installer dotenv can set existing locale configuration, but theme-mode scaffolding is open. |
| 55 | `test-files-require-source-sibling` blocks a real-runtime test that has no natural sibling. | Documented: tests/ is the integration-fixture location; src sibling rule remains enforced. |
| 56 | Hook tests need a providers wrapper and the template gives you nowhere to put it. | Implemented: tests/render-with-providers.tsx creates independent QueryClient/i18next instances and MemoryRouter; isolation regression covers cached data and translations. |
| 57 | `no-sleep-in-e2e` flags `test.setTimeout(...)`. | Implemented: test.setTimeout is permitted; timer sleeps and page.waitForTimeout are rejected with controls. |
| 58 | Playwright's pre-push hook runs the full `check`, so a `git push` wrapped in a short `timeout` silently kills typecheck. | Policy retained: full push gates are not bypassed; use sufficient command timeout and focused checks during iteration. |
| 59 | `agent:verify` sandboxes do not survive a host restart, and the tooling does not say so. | Partial: missing descriptor reports sandbox_not_found; post-restart container recovery is not claimed. |
| 60 | Wins. | Preserve: reported win; no corrective change requested. |
| 61 | Accepting an inventory that removes a test needs a second flag the preview does not mention. | Implemented: inventory preview prints exact acceptance command, including removal acknowledgement when needed. |
| 62 | The dev stack applies schema with `db:push --force`, so a freshly generated migration changes nothing until you know that. | Documented: migration-history verification differs from schema push (17). |
| 63 | `i18n-locale-keys-used` cannot see keys built from a variable prefix. | Needs product dynamic-key expression; arbitrary variable prefixes cannot be proven statically without a declared key set. |
| 64 | `no-cross-resource-internal-imports` fires with no hint that an `index.ts` public surface is the fix. | Addressed in generated public barrel and validation guide; existing rule enforces importing that surface. |
| 65 | `mutating-service-must-audit` matches private helpers by prefix. | Implemented upstream: `eslint-plugin-audit-log` 0.2.0 checks the public surface only; module-private functions and private/protected methods are body of the audited method, `includePrivate` restores the old scan (boringstack-xyz/eslint-plugins#15). Audit guide updated. |
| 66 | `switch-exhaustiveness-check` on a nullable union forces an if-chain. | Policy retained: do not weaken exhaustive handling based on one nullable switch; need the expression to assess. |
| 67 | Wins. | Preserve: reported win; no corrective change requested. |
| 68 | Importing the i18n config into a test fixture flips every test in the folder to real copy. | Documented: avoid application singleton i18n in cross-test fixtures (14). |
| 69 | `max-hooks-per-file` counts exported hooks, not hook calls; the message could say so. | Already explicit in installed plugin: diagnostic says “This file exports ... hooks”, names them, and suggests focused modules. |
| 70 | `static-translation-key-exists` does not understand i18next plural suffixes. | Implemented upstream: `@boring-stack-pkg/eslint-plugin-i18n-keys` 0.1.3 resolves `count`, `ordinal` and `context` suffixes the way i18next does (boringstack-xyz/eslint-plugins#10); the template pins the release and checks it through the real ESLint entry point. |
| 71 | Account-scoped tables need four registrations, none discoverable from the schema file. | Partial: generator now registers each generated table in the ESLint account-scope list, alongside schema export, relations and test cleanup. General hand-written schema drift detection remains open. |
| 72 | Wins. | Preserve: reported win; no corrective change requested. |
| 73 | `static-translation-key-exists` again: hand-rolled plurals spread. | Implemented upstream with 70; counted calls need an `_other` fallback, and the guide documents the accepted forms. |
| 74 | Wins. | Preserve: reported win; no corrective change requested. |
| 75 | `WITH_OBSERVABILITY=0` leaves the OTEL exporter pointed at a Tempo that does not exist, and the retries rate-limit the developer's DNS. | Implemented: Tempo default exists only in observability overlay; matrix covers absent, empty and external endpoints in dev/prod. |
| 76 | A sandbox lease survives its owner's death and can only be reclaimed by destroying the sandbox. | Implemented: explicit dead-owner lease recovery, live-owner refusal, replacement-token protection and regression. |
| 77 | Adding a component kind touches nine places with nothing to enumerate them. | Product-specific registry: need its actual nine registration sites; not a universal template component-kind generator. |
| 78 | `generate:api` widens `t.Integer()` to `string / number` on some nested objects. | Needs nested schema fixture (38). |
| 79 | Wins. | Preserve: reported win; no corrective change requested. |
| 80 | `react-hooks/exhaustive-deps` and a single-store selector style fight each other on big view hooks. | Needs hook/store selector code and stale-state reproduction; no exhaustive-deps exemption. |
| 81 | Wins. | Preserve: reported win; no corrective change requested. |
| 82 | `component-folder-structure` treats every `const X: FC` in a folder as a component needing its own siblings. | Implemented upstream: `eslint-plugin-react-component-architecture` 0.3.1 exempts `.tsx` files that export nothing; the anatomy applies once a file gains an export (boringstack-xyz/eslint-plugins#15). Component anatomy guide updated. |
| 83 | Wins. | Preserve: reported win; no corrective change requested. |
