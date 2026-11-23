# Walkthroughs

A walkthrough is a Playwright spec that walks one change through the running
app, one named step at a time, with a screenshot after every step. The
factory runs them with `bun run factory walk <file>` and prints the list of
screenshots for the verification record's "Walked in browser" section.

- Name the file `<scenario>.walk.ts`. The normal e2e suite skips these.
- Import `test` and `expect` from `./walk.fixture`, not `@playwright/test`.
- Wrap each user-visible action in `walk.step("…", async () => { … })`. The
  title is what the record shows, so write it in plain words.
- Start with `test.use({ baseURL: process.env.FACTORY_BASE_URL })`, as the
  example does.
- Screenshots and `steps.json` go to `.agent-state/factory/walk/<run-id>/`.

Example: `sign-up-to-dashboard.walk.ts` (sign-up, verify, dashboard).
