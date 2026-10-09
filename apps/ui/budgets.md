# Bundle budget reasons

Limits in `.size-limit.json` do not go up silently. `bun run check:size-budget`
(part of `bun run validate`, CI and pre-push) fails when a limit is raised, or a
new entry is added, unless this file has a reason for that entry that is new or
changed in the same change. Compare against the base branch, so an old reason
cannot cover a later raise.

Each reason is one line, written as the entry name in backticks, a colon, then
the reason in a sentence. Reasons are at least ten characters long. Lowering a
limit, or leaving it alone, needs no line here.

Budgets are reviewed per feature. A raise states what grew and why the growth
is acceptable, and the line is kept as the record of that decision.
