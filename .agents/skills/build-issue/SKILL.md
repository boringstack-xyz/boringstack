---
name: build-issue
description: Build one issue of this repository end to end with the software factory, test-first, and hand it over for review. Use when asked to build an issue ("build issue 123", "/build-issue 123", "build this ticket"). Works with GitHub Issues and with Linear (FACTORY_TRACKER). Pass --dry-run to print the plan and stop.
---

# Build an issue with the factory

Input: an issue id (`123` on GitHub, `ENG-123` on Linear), optionally `--dry-run`.

Read `AGENTS.md` first. Its rules apply to every step here. Nobody answers
while you work: decide, write the decision down (in the verification record's
Review section), and keep going. Only a person can unblock what appears in
step 1's "person-only" list.

The factory's own contract is `tools/factory/README.md`. Every command below is
`bun run factory <command>`. A command that answers "is not built yet" is
blocked, not passed: record it under "Not verified" and continue with what can
run.

## 1. Plan (always; `--dry-run` stops here)

1. Read the issue: `bun run factory issue <id>`. It prints the title, labels,
   the acceptance criteria it states, and the body. Open any linked screenshots
   and read them as part of the spec.
2. If the issue states no acceptance criteria, derive them from the body and
   mark each one **inferred** in the plan. State them in the verification
   record's Review section so a person can correct them.
3. Look up earlier builds of the same kind: list `docs/build-notes/*.md`
   (`head -n 6` each) and read every note whose `kind` or keywords match. Say in
   the plan which notes you used, or that none fits. The `build-notes` skill
   (`.claude/skills/build-notes/SKILL.md`) has the format.
4. Turn each acceptance criterion into a named check, and name the file the
   check will live in:
   - a flow in the app: a robot journey in `apps/ui/e2e/robot/*.spec.ts`, or a
     Playwright test beside the feature;
   - an endpoint or data rule: a test in `apps/api`;
   - logic: a unit test next to the code (`*.test.ts`).
   Any **new route or API operation** also gets a production robot journey,
   and its coverage entry in `apps/ui/e2e/robot/coverage.ts` or
   `api-coverage.ts`, as `docs/operations/production-verification.md` describes.
   A new endpoint fails `validate` until it has one, or a written reason.
5. List person-only blockers: secrets, accounts, consent screens, product
   decisions, anything in production. Plan around them; do not stop for them
   while other work can move.
6. Print the plan as a table: criterion → check (file) → repos or apps touched
   → blockers. With `--dry-run`, stop here. Change nothing.

## 2. Build, one issue at a time

The loop follows `tools/factory/README.md`, in order.

1. **Isolate.** `bun run factory workspace new <id>` claims a slot and a
   worktree on branch `factory/<id>`. Work only in that worktree. Then
   `bun run factory up`, `bun run factory preview` (print the preview link on
   the issue's card once it exists), and `bun run factory status "<what you are
   doing>"` at each step, so the fleet page reads in plain words.
2. **Checks first.** Write the checks from the plan and watch them fail
   (`bun test <file>`, the app's `bun run validate`, the robot's spec).
3. **Build.** Write code until the checks pass. Smallest change that does it.
4. **Prove, in this order:**
   1. `bun run factory walk <scenario-file>`: click through every acceptance
      criterion in the running product, with a screenshot per step. Look at each
      screenshot. Checks passing on something nobody can see working prove
      nothing.
   2. `bun run factory browse`: every route opens signed in with no script
      errors or failed API calls.
   3. `bun run factory verify`: the checks for every app the branch changed,
      with failures that also fail on the base commit marked as warnings.
   4. A fresh-context review: start a subagent that gets only the issue text
      and its acceptance criteria, and the branch's diff against its base. It
      reports whether the diff does what the issue asks. Fix each finding, or
      dismiss it with a reason. Never ignore one silently.
   5. `bun run factory verification new <branch>`, fill every section (no
      `TODO`), then `bun run factory verification check <branch>` must pass.
      Risk sets how deep people review: pick the highest level any part of the
      change reaches (`ui`, `logic`, `data`, `auth-billing`).
   6. `bun run factory gate`: the same checks the Stop hook runs.
5. **Commit and push.** Commit on `factory/<id>`, then
   `git push -u origin factory/<id>`. Pushing is not a pull request.
6. **Hand over.** `bun run factory handover factory/<id>` posts the one
   hand-over card on the issue (edited in place) and moves the issue to review.
   It refuses (exit 2) while the branch is not on GitHub or the record is
   incomplete: fix what it names, then run it again.
7. **Pull request.** Only when a person says to ship it: `bun run factory pr
   factory/<id>`. It opens a draft until the record is complete, with Risk on
   the first line. Agents never merge.
8. **Tear down** when the person is done: `bun run factory down -v`, then
   `bun run factory workspace remove <name>`. Both refuse uncommitted or
   unpushed work.
9. **Compound.** Write this build's note (`build-notes` skill) and put its path
   in the record's Build note section. Put every fix you made to this skill or
   `AGENTS.md` under "For the next session".

## 3. When blocked

Only a person can unblock the issue:

1. Add the ask to `docs/FOR_OWNER.md` (what, why, steps, risk, undo). Say on the
   issue what is needed and from whom.
2. Finish every part that does not need it: code against a test double, the
   tests, the docs. Leave the rest marked in the record's Not verified section.
3. If nothing else can move, write the reason to `.agent-state/factory/BLOCKED`
   and stop. The Stop hook accepts a blocked stop only with that file.

## Never

- Merge a pull request, push to `main`, or force push (the guard hook refuses
  these too).
- Read or print secret files (`.env`, keys). Run `kubectl`, `helm`, `vault` or
  `terraform apply` (the guard hook refuses these too).
- Mark an issue done. People do that after review.
- Touch production. The robot checks production; agents do not run it there.
