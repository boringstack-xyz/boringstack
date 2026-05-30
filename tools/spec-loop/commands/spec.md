---
description: Solo founder rolling-wave spec loop: init, explore, slice, approve, build, learn, status, ship, reset.
allowed-tools: Read, Write, Edit, MultiEdit, Bash, Glob, Grep, LS
argument-hint: init | explore <idea> | slice | approve | build | learn | status | ship | reset
---

You are running Solo Spec Loop: a lightweight workflow for one founder using AI as a collaborator, not an enterprise spec factory.

**How the human invokes this prompt:** In **Claude Code**, plugin commands are namespaced: this file is `commands/spec.md`, so the slash command is **`/solo-spec-loop:spec`** plus arguments (e.g. `/solo-spec-loop:spec init`). In **Cursor** or a **project-local** `.claude/commands/` copy, the same prompt may appear as **`/spec`** — use whatever the host’s command palette shows for this document.

Command: $ARGUMENTS

Principles:

- **Capture intent** — record decisions in `.specs/next.md`; the spec is a checkpoint, not a chat that evaporates.
- **Visible, changeable decisions** — Problem (requirement) vs Design decisions + Slice (solution) vs Verification contract (executable spec); keep them distinct.
- **Executable verification** — runnable acceptance check proves the slice; `ship` re-runs it.
- **Slice zoom only** — parent context is one line in Purpose, not extra spec files.
- The spec is a conversation checkpoint, not a handoff document.
- Work in vertical slices. Small batch size is non-negotiable.
- Capture only earned understanding. Mark uncertain things as assumptions or questions.
- Prefer a tiny event sketch or 1–2 rules/examples over long prose: Trigger → change → observable result.
- Define verification before implementation: invariants, explicit negatives, outcome-oriented acceptance check.
- Do not generate feature folders, ADR files, research docs, diagrams, or extra Markdown unless the human explicitly asks.
- Use exactly one living file: `.specs/next.md`.
- Line budget: **target 90, soft warning 120, hard stop 140**. Past 120, shrink the slice instead of adding detail. The gate hard-blocks source writes past 140.

Spec smells (fix in `slice`, check in `status` / before `approve`): vague, kitchen sink, lossy, immortal ticket, PRD-as-spec.

Question budget:

- Ask at most 5 questions.
- Ask only questions where the answer changes behavior, UX, data, security, scope, or the verification contract.
- For everything else, propose a default in Assumptions and move on.

Plan-mode pairing:

- Run `explore` and `slice` in Cursor Plan mode or Claude Code plan mode. The agent should not be writing source while the slice is still draft. The PreToolUse gate enforces this for source files; plan mode keeps you honest about everything else.

Modes:

`init`

1. If `.specs/next.md` already exists, do nothing and print its current `status:` and `slice:`.
2. Otherwise, create `.specs/` and copy the bundled template into `.specs/next.md`.
   - Bundled template: `${CLAUDE_PLUGIN_ROOT}/templates/next.md` if available, else inline the canonical structure (frontmatter, Problem, Purpose, One-session exit condition, Design decisions, Event sketch, optional Rules/examples, Slice, Questions, Assumptions, Verification contract, Spec smells, Not doing, Files likely touched, Build notes).
3. Print: "Spec loop active. Next: `/solo-spec-loop:spec explore <idea>`" (or `/spec explore <idea>` if the user runs from a project-local command — match their environment).

`explore <idea>`

1. Inspect only enough repo context to avoid obvious nonsense.
2. Update `.specs/next.md` as a lightweight discovery artifact.
3. State the **Problem** in one sentence (problem-only language). Flag any solution language in the human's idea (button, API, email, page, database) and rewrite as problem where needed.
4. Fill: Problem, Purpose, One-session exit condition, Design decisions (initial guesses), Event sketch or Rules/examples stub, Slice, Questions, Assumptions, Verification contract (draft), Not doing, Files likely touched.
5. End with either up to 5 important questions or: "No blocking questions. Proposed defaults are in Assumptions."
6. Do not write implementation code.

`slice`

1. Read `.specs/next.md` and relevant code.
2. Run a **spec-smell pass**: vague → sharpen trigger/result; kitchen sink → split slice and move extras to Not doing; lossy → add ≥1 Must not happen; immortal ticket → remove task noise; PRD-as-spec → add Design decisions, not more problem prose.
3. Reduce scope until the slice can be built, reviewed, and reverted in one focused session.
4. Ensure Event sketch (or Rules/examples) describes **one** user/system trigger and **one** observable result.
5. Ensure Verification contract includes:
   - Must remain true (invariants)
   - Must not happen (≥1 explicit negative case)
   - Acceptance check (runnable command; outcome-oriented, not implementation-specific)
6. Update Spec smells checkboxes to reflect the pass (checked = clear).
7. Remove stale detail instead of adding more sections. If line count > 120, shrink the slice.
8. Do not write implementation code.

`approve`
Only if the human has explicitly approved this exact slice, **design decisions**, and verification contract (not vibe-only).
Set frontmatter `status: approved` and set `approved_at` if date/time is available.
Do not implement.

`build`

1. Read `.specs/next.md` first.
2. Proceed only if `status: approved`.
3. Implement only the approved slice.
4. Order: **spec → test(s) proving the Verification contract → code**. Test names/descriptions should read as specs (intent visible without reading implementation).
5. If test skeletons are missing and the change is non-trivial, create them before feature code.
6. Run the most relevant checks.
7. Update Build notes in 3-5 bullets: changed, checked, learned, follow-up.
8. If a material ambiguity appears, stop and ask instead of expanding scope.
9. Context-refresh hint: if you've gone past about 3 revisions on the same slice, stop and ask the user to `/clear`. Restart the session with only `.specs/next.md` and the files you're currently editing.

`learn`
Update only Build notes, Problem, Design decisions, Assumptions, Verification contract, or Not doing with what reality taught us.
Tag discoveries when useful: requirement change | design change | spec wording only.
On late discovery: update the spec first; note test/code follow-up in Build notes.
If a reusable convention is worth saving, propose one line and ask before editing project docs.
Do not create ADRs unless explicitly asked.

`status`
Read `.specs/next.md` frontmatter and print:

- `status:` (draft | approved)
- `slice:` (one-line summary)
- `approved_at:` and the rough number of days since approval (if set)
- Current line count vs. the 90 / 120 / 140 budget
- Spec smells: Y/N for each — vague, kitchen sink, lossy, immortal ticket, PRD-as-spec
- The verification contract's acceptance check, verbatim

Do not modify the spec.

`ship`

1. Read `.specs/next.md`.
2. Proceed only if `status: approved`.
3. Run the acceptance check from the Verification contract verbatim (executable-spec verification). If it is not a runnable command, stop and ask the user to tighten the contract first.
4. Append a single Build notes line: `<YYYY-MM-DD> ship: <pass|fail> -- <command>`.
5. On pass, prompt: "Ship verified. Run the spec command with `learn` … or `reset` …" (use the same slash prefix the user has been using, e.g. `/solo-spec-loop:spec learn` in Claude Code).
6. On fail, do not modify anything else; print the failing command's output and stop.

`reset`
Archive nothing by default. Clear `.specs/next.md` back to the template for the next slice. Before resetting, summarize any unresolved follow-ups in 3 bullets max.
