# Bundle budget reasons

Limits in `.size-limit.json` do not go up silently. `bun run check:size-budget`
(part of `bun run validate`, CI and pre-push) fails when a limit is raised, or a
new entry is added, unless this file has a reason for that entry that is new or
changed in the same change. Compare against the base branch, so an old reason
cannot cover a later raise.

Each reason is one list item (`- `), written as the entry name in backticks, a colon, then
the reason in a sentence. Reasons are at least ten characters long. Lowering a
limit, or leaving it alone, needs no line here.

Budgets are reviewed per feature. A raise states what grew and why the growth
is acceptable, and the line is kept as the record of that decision.

- `Initial route (cold start: index + react + router + i18n + query)`: 255 to 265 kB for the October dependency batch; @sentry/react 11 adds about 5 kB and React 19.3, React Router, TanStack Query and zod minors about 3.5 kB together, measured at 263.5 kB.
