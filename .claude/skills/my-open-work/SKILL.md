---
name: my-open-work
description: A person's open work in this repository's factory, as one short risk-ordered list: what waits on them (issues in review to try, pull requests to review, questions to answer), what is stuck (blocked sessions, failing checks, conflicts), and what agents could pick up next. Use when someone asks "what's on my plate", "what needs me", "my open work", "morning triage", or runs /my-open-work. Read-only until the person picks an item.
---

# My open work

One list, read in a minute, of everything in the factory that waits on this
person. Gather everything first, act only on what they pick.

The tracker is GitHub Issues by default, and Linear when `FACTORY_TRACKER` is
`linear`. Read which one with `bun run factory issue <id>` (it names the tracker
on errors) or the environment; the checks below name both.

## 1. Gather (read-only, in parallel)

Run these at the same time. One failing source is a line in the list, never a
reason to stop.

- **Issues in review** (GitHub): `gh issue list --label factory:review --state
  open --json number,title,url`. Each is waiting for someone to try the change.
  Read its hand-over card: the last comment that carries the marker
  `<!-- factory:handover -->` (`gh issue view <n> --comments`).
- **Issues in review** (Linear): `list_issues` with the state named "In Review"
  (or "👀 Review") assigned to the person, and their newest comments.
- **Pull requests to review**: `gh pr list --search "review-requested:@me"
  --state open --json number,title,url,body`. Read each body's first line,
  `**Risk: <level>**`. No such line means an older PR: treat it as `data`.
- **Their own pull requests**: `gh pr list --author @me --state open --json
  number,title,url,isDraft,reviewDecision,mergeable`. Changes requested, a merge
  conflict, or a failing check is stuck work.
- **Blocked sessions**: `.agent-state/factory/BLOCKED` in each factory
  workspace (read it: it says on whom and why), and `docs/FOR_OWNER.md` for
  asks only a person can answer.
- **Could start**: open issues with no `factory:*` label, that state acceptance
  criteria (`bun run factory issue <n>` shows them).

## 2. Show the list

Plain language, one line per item, each with its link. No git terms for a
designer or product person: "the change for the billing page is waiting for you
to try it", not "PR #123 on factory/12". Skip empty groups.

```
Needs you (N)
  1. Try: <issue title>, preview <link>, <what to look at>
  2. Answer: <the question, in one line>, <issue link>
  3. Review: <PR title>, Risk: auth-billing, <link>
Stuck (N)
  4. <issue or PR>: <what is wrong, in one line> → <the fix you can do>
Could start (N)
  5. <issue title>, <link>
```

Order "Needs you" by what unblocks the most work: an answer an agent is waiting
on first, then tries, then reviews by risk (`auth-billing`, `data`, `logic`,
`ui`). Number every item across the groups.

## 3. Act on what they pick

Ask which numbers to take on, then do only those.

- **Try**: open the preview. Their verdict goes on the issue as a comment. "Ship
  it" means `bun run factory pr factory/<n>` for that branch.
- **Answer**: post their answer as a comment on the issue. If a session is
  blocked on it, delete that session's `.agent-state/factory/BLOCKED` so it can
  carry on, and say so.
- **Review**: read the PR's Verification section first, then read the code as
  deep as its risk level asks.
- **Stuck**: a failing check or conflict is a job for a build on that branch.
  Never push to someone else's branch.
- **Could start**: run `build-issue` on that issue.

Comments, deletions and new builds change shared state. Confirm each with the
person before doing it.
