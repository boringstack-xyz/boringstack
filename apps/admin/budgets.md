# Bundle budget reasons

Limits in `.size-limit.json` do not go up silently. `bun run check:size-budget`
(part of `bun run validate`) fails when a limit is raised, or a new entry is
added, unless this file has a reason for that entry that is new or changed in
the same change. The check is the same gate `apps/ui` uses, run with
`SIZE_BUDGET_APP_ROOT` pointing here. Lowering a limit needs no line.

Each reason is one list item (`- `), written as the entry name in backticks, a
colon, then the reason in a sentence.

- `Dashboard bundle (index + react)`: first budget for the operator dashboard, measured at 93.4 kB gzipped with the queues, activity, feed and campaigns pages; 104 kB leaves room for one more page.
- `CSS`: first budget for the dashboard stylesheet, measured at 528 B gzipped; 2 kB is headroom for a few more rules.
