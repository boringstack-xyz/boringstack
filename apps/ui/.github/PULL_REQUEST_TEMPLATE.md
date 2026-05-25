<!--
This template is mandatory. Skipping sections is fine; deleting them is not.
The structure mirrors AGENT_REVIEW.md so reviewers see the same shape every PR.
-->

## What changed

<!-- 1–3 bullets. The "why" matters more than the "what" — the diff already shows the "what". -->

-
-

## Linked issue / context

<!-- Closes #..., or paste the Slack/Linear/spec link the change came from. -->

## Type

- [ ] feat — new user-visible behavior
- [ ] fix — corrects a defect; no behavior change beyond the fix
- [ ] refactor — no functional change
- [ ] chore — tooling / deps / infra
- [ ] docs — text only

## Merge bar (`pnpm validate` must pass)

- [ ] `pnpm check` — lint + lint:meta + format + typecheck green
- [ ] `pnpm test:ci` — Vitest green, coverage floor held
- [ ] `pnpm e2e:ci` — Playwright green on Chromium + WebKit
- [ ] `pnpm build` — production build green
- [ ] `pnpm size:check` — bundle budgets held (or budget intentionally raised in this PR)

## Agent review (full template: [AGENT_REVIEW.md](../AGENT_REVIEW.md))

Quick spot-check — fill in any item that's non-obvious from the diff:

- [ ] **TypeScript**: no `any`, no `!`, no `as` (except `as const`)
- [ ] **A11y**: every input has a label, every interactive element supports keyboard
- [ ] **i18n**: no hardcoded JSX strings — all flow through `t()`
- [ ] **API**: requests go through `apiClient.GET/POST/...`; types come from `schema.d.ts`
- [ ] **State**: server state in `*.queries.ts`, client state in `*.store.ts`, form state in RHF
- [ ] **Tests**: new logic has Vitest coverage; new user paths have a Playwright spec
- [ ] **Component anatomy**: any new component has the 8-file folder (or is in `components/ui/`)
- [ ] **Security**: no PII in logs, no secrets in code, no raw `fetch`

## Screenshots / recordings

<!-- Required for UI changes. Drag and drop here. -->

## Migration / rollout notes

<!-- Anything reviewers or future contributors need to know — feature flag, env var, db migration in the api-template. -->
