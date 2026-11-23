# The software factory

`bun run factory <command>` turns an issue into a verified, reviewable change
with an agent doing the work and a person deciding. It is the same loop the
Dreamdata factory runs on, cut down to one monorepo: one worktree, one stack,
one branch, one pull request per issue.

Exit codes everywhere: **0 done, 1 failed, 2 blocked**. Blocked means a person
or a missing prerequisite must act; it is never a pass. `--json` prints the
outcome object instead of the one-line summary.

## The loop

1. **Issue.** A person writes an issue with acceptance criteria (GitHub Issues
   by default, Linear with `FACTORY_TRACKER=linear` and `LINEAR_API_KEY`).
2. **Plan.** The `build-issue` skill reads the issue (`factory issue <id>`),
   earlier build notes (`docs/build-notes/`), and turns each criterion into a
   named check: a robot journey, an API test, a UI test or a unit test. It
   lists what only a person can provide. `--dry-run` stops here.
3. **Isolate.** `factory workspace new <issue>` claims a free slot and creates
   a worktree on branch `factory/<issue>`. `factory up` starts that slot's own
   stack (own compose project, ports, database); `factory preview` prints its
   URL; `factory status` says in plain words what it is doing (the fleet page
   shows it).
4. **Build, checks first.** The checks fail, then code makes them pass. Every
   new route and API operation gets a production robot journey
   (`docs/operations/production-verification.md`).
5. **Prove.** `factory browse` opens every route signed in; `factory walk`
   walks the change with a screenshot per step; `factory verify` runs
   `agent:verify` for the apps the branch changed and compares failures with
   the base commit; a fresh-context review reads the diff against the issue
   text only; `factory verification new|check <branch>` writes and checks the
   record.
6. **Gate.** The Stop hook (`factory hook stop`) will not let the session
   finish while a changed app has no passing verify at the current commit, or
   a pushed branch has no complete record. `factory gate` runs the same checks
   by hand.
7. **Hand over.** Push the branch; `factory handover <branch>` posts one card
   on the issue (edited in place, never duplicated) and moves it to review.
8. **PR.** When a person says ship it, `factory pr <branch>` opens the pull
   request: draft until the record is complete, Risk on the first line, the
   record as the body. **Agents never merge.**
9. **Tear down.** `factory down -v` and `factory workspace remove` refuse while
   work is uncommitted or unpushed. `factory sweep` (hourly on a shared box)
   removes stacks whose checkout is gone.
10. **Compound.** Each build leaves a note in `docs/build-notes/`; `factory
verification gaps` lists recent "Not verified" items for the weekly review;
    `factory findings` groups errors from every stack's logs and files the new
    ones as issues.

## Where things live

| What                      | Where                                                                            | Shared by                     |
| ------------------------- | -------------------------------------------------------------------------------- | ----------------------------- |
| Per-checkout state        | `.agent-state/factory/` (ignored)                                                | one checkout                  |
| Machine-wide coordination | `FACTORY_SHARED_DIR`, default `.agent-state/factory/shared` of the main checkout | every checkout on the machine |
| Workspaces (worktrees)    | `../<project>-workspaces/<name>` next to the main checkout                       |                               |
| Slot claims               | `<shared>/slots/s<N>.json`, created exclusively (`wx`)                           |                               |
| Preview routes            | `<shared>/preview/s<N>.json`                                                     |                               |
| Status lines              | `<shared>/status/s<N>.json`                                                      |                               |
| Verify results            | `.agent-state/factory/verify/<run-id>.json`, `latest.json`                       |                               |
| Verification records      | `.agent-state/factory/verifications/<branch-slug>.md`                            | copied into the PR body       |
| Session baselines         | `.agent-state/factory/sessions/<session-id>.json`                                |                               |
| Blocked marker            | `.agent-state/factory/BLOCKED`                                                   |                               |
| Knobs                     | `tools/factory/factory.config.ts`                                                |                               |
| Environment               | `tools/factory/environment.ts` (the only `process.env` reader)                   |                               |

## Slots

Slot 0 is the developer's own `./setup.sh --up` stack on the default ports.
Slots 1..`maxSlots` are factory stacks: compose project `<project>-s<N>`, host
ports `portBases.<service> + N`, their own volumes. A slot is claimed by
creating its claim file exclusively; the claim names the workspace path. A
claim whose workspace path no longer exists is stale and `sweep` frees it.
Slot stacks bind to `127.0.0.1` only.

## The record

`factory verification new <branch>` writes the skeleton; the agent fills it.
Sections, all required: **Risk** (`ui`, `logic`, `data` or `auth-billing`,
which sets how deep review goes), **Checks run** (from `factory verify`),
**Walked in browser**, **Review**, **Not verified** (an honest list; "none"
must be written), **For the next session**, **Build note**. The record carries
the commit it describes; `check` fails when HEAD has moved since, so a record
of old code never counts.

## Hooks

`.claude/settings.json` (and the generated `.codex/hooks.json`) wire:

- `PreToolUse` → `factory hook guard`: refuses force pushes, pushes to a
  protected branch, reading or printing secret files, and branch switches in
  the main checkout. Tripwires, not a sandbox.
- `SessionStart` → `factory hook baseline`: remembers the commit the session
  started from.
- `Stop` → `factory hook stop`: the gate above. Writing a reason to
  `.agent-state/factory/BLOCKED` lets a session stop when only a person can
  unblock it; the hook challenges it once. Three identical blocks in a row
  release the session, so a broken gate cannot trap it.

These coexist with `tools/spec-loop`'s planning gate.

## Agent lanes

The lanes (`tools/factory/lanes/`) are the agents that work on a change after a
person has asked for it: each one opens pull requests on its own branch,
`agent/<lane>/<slug>`, and a person decides every one. **Agents never merge.**
They are off until the repository variable `AGENTS_ENABLED` is `1`; every
agent workflow checks it first.

| Piece         | Where                                                           | What it does                                                                                                                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lane registry | `lanes/lanes.ts`                                                | What a lane may change (allow and deny paths), whether its fix needs a regression test, and how many PRs it may have open or merge in seven days. Only `triage` is ported.                                                                                                   |
| Triage        | `agent-triage.yml`, `bun run factory lanes triage [--dispatch]` | Takes the next findings from the findings ledger (`factory findings`), not from n8n. A person sends them with `--dispatch`, which starts the workflow. For each finding the agent writes a plan: a code fix becomes a PR, an operations cause becomes an issue for a person. |
| Proof         | `lanes prove`                                                   | Runs the fix's tests on HEAD with the fix set aside, then with it. Proven only when they fail on HEAD and pass with the fix, with no skipped tests. The report says `proven: true` or `false`; an unproven fix is a result, not an error.                                    |
| Review        | `agent-review.yml`                                              | An independent reviewer reads the diff and the issue, not the author's reasoning, and writes `Verdict: approve` or `Verdict: reject` into the Review section of the PR's record. Rejection fails the job. The reviewer's helpers come from the base branch.                  |
| Revise        | `agent-revise.yml`                                              | After a rejection: one revision on the same branch, proved again, then the review runs again. After a second rejection the PR is closed.                                                                                                                                     |
| Digest        | `agent-digest.yml`, `lanes digest`                              | Weekly: agent PRs merged, closed and open, and failed agent runs, as an issue labelled `agent-digest`.                                                                                                                                                                       |
| Setup         | `.github/actions/agent-setup`                                   | The kill switch, Bun 1.4.4 and the git identity. It holds no secrets.                                                                                                                                                                                                        |

Exit codes follow the rest of the factory: 0 done, 1 failed, 2 blocked. The
`lanes` commands read their input from a file or stdin and write their output to
a file, so the workflows can call them directly with `bun tools/factory/cli.ts`.

Secrets and variables: the workflows need the repository secret
`CLAUDE_CODE_OAUTH_TOKEN`. Set `AGENTS_ENABLED` to `1` to turn the lanes on, and
to anything else to turn them off. The triage workflow dispatches the review, so
the workflow token needs `actions: write`, which the workflows request.

Not verified here: the workflows have not run on GitHub, and the Claude action
has not been called against a real PR. Set `AGENTS_ENABLED` to `1` on a fork or a
test repository before relying on them.

## Principles

- Done means it was seen working in the running product, not that a unit
  test passed.
- Checks the agent cannot skip are enforced by hooks and commands, not by
  asking.
- An honest "Not verified" beats a claim.
- Every fix lives in code, so `factory down -v && factory up` reproduces it.
- Unattended: decide, write the decision on the issue, keep going. Blocked
  means only a person can provide it.
- Agents never merge, never push to a protected branch, never touch
  production.
- Plain language in status lines and hand-overs: they are read by people who
  do not read code.
