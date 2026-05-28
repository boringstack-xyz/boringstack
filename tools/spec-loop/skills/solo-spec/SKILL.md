---
name: solo-spec
description: Use when the user asks to add a feature, build something new, or modify behavior in a project that has `.specs/next.md`. Drives the spec loop instead of jumping to implementation. Also use when the user mentions /spec, /solo-spec-loop:spec, the spec loop, or asks to "spec out" or "slice" a piece of work.
---

# Solo Spec Loop

The **agreement** is tool-agnostic: one `.specs/next.md`, same loop, same frontmatter. This skill applies in any agent that can read the repo; hard enforcement (`solo_spec_gate.py`) only exists where the host wires PreToolUse-style hooks.

If `.specs/next.md` exists in the project root (or any parent up to the git root), the spec loop is the way to do non-trivial work in this project. Use it instead of jumping to implementation.

## Trigger

Activate this skill when:

- The user asks to add a feature, build something new, or modify behavior.
- The user mentions `/spec`, `/solo-spec-loop:spec`, "spec out", "slice", "the spec loop", or "the next slice".
- A `.specs/next.md` file exists somewhere in the cwd ancestry.

If `.specs/next.md` does not exist, the project has not opted in. Suggest the spec slash command with `init` (e.g. `/solo-spec-loop:spec init` in Claude Code) only if the user is starting non-trivial work; otherwise proceed normally.

## Loop

`explore -> slice -> approve -> build -> learn`. Optional: `init`, `status`, `ship`, `reset`.

## Three layers in the spec

Distinguish three layers in `.specs/next.md`:

- **Problem** — requirement / why (problem-only language)
- **Design decisions + Slice** — solution choices and what to build now
- **Verification contract** — executable spec (invariants, negatives, runnable acceptance check)

## Hard rules

- One living file: `.specs/next.md`. No ADR forest, no per-feature folders, no research docs.
- Line budget: **target 90, soft 120, hard 140**. Past 120, shrink the slice. The hook hard-blocks source writes past 140.
- The spec is a checkpoint, not a handoff document. Capture earned understanding, not premature certainty.
- Run `explore` and `slice` in read-only / plan mode if the product has one (e.g. Cursor Plan, Claude Code plan mode). No source code while the slice is draft.
- Verification contract: Must remain true, Must not happen (≥1 negative), outcome-oriented acceptance check (command, not prose).
- Before `build`: order is **spec → tests proving contract → code**. Tests should read as specs.
- `solo_spec_gate.py` (when installed) blocks source writes until `status: approved`. Without the hook, enforce the same in behavior.
- During build, past ~3 revisions on the same slice: stop and ask for `/clear` with only the spec and active files in context.

## Spec smells

Fix in `slice`; self-check in `status` before approve:

- **Vague** — no single trigger + observable result
- **Kitchen sink** — multiple concerns in one slice
- **Lossy** — missing negatives / edges in contract
- **Immortal ticket** — task dump, not a living spec
- **PRD-as-spec** — problem prose without design decisions

## Question budget

Five questions, max. Only ones that change behavior, UX, data, security, scope, or the verification contract. Everything else: default in Assumptions.

## Anti-patterns

- PRD-as-spec (problem-only, no Design decisions)
- Kitchen-sink slice (split and use Not doing)
- Vague acceptance check or implementation-specific tests
- Long requirements docs, constitution trees, verifier subagent orchestration

## What this skill does NOT do

- Generate long requirements docs or per-feature spec folders.
- Create constitution / ADR / phase / task / wave directories.
- Spawn verifier subagents or run multi-agent orchestration.
- Maintain delta specs in per-change directories.

If the user wants any of those, they're picking a different framework (Spec Kit, GSD, OpenSpec). Solo Spec Loop is deliberately minimal.

## Slash command

Arguments: `init | explore <idea> | slice | approve | build | learn | status | ship | reset`.

**Claude Code:** `/solo-spec-loop:spec <arguments>`

**Cursor / project-local:** may be `/spec <arguments>`.

See `commands/spec.md` for full mode semantics.
