# Solo Spec Loop

[![CI](https://github.com/agjs/solo-spec-loop/actions/workflows/ci.yml/badge.svg)](https://github.com/agjs/solo-spec-loop/actions/workflows/ci.yml)

One file, one loop, one gate. Stops AI agents from sprinting ahead of you.

## What it is

A workflow for solo founders using AI to build:

```text
explore → slice → approve → build → learn
```

Lives in one file per project: `.specs/next.md`.

## The problem

You ask an AI for a small feature. You get a folder tree, an ADR forest, and 800 lines of code for something nobody designed. Reviewing it is slower than writing it yourself.

Solo Spec Loop forces a checkpoint: the agent can't touch source until you've explicitly approved a small, vertical slice with a runnable acceptance check.

## Claude Code

```text
/plugin marketplace add agjs/solo-spec-loop
/plugin install solo-spec-loop
/reload-plugins
```

```text
/solo-spec-loop:spec init
/solo-spec-loop:spec explore <idea>
/solo-spec-loop:spec slice
/solo-spec-loop:spec approve
/solo-spec-loop:spec build
```

Clash with another marketplace? `/plugin install solo-spec-loop@agjs-solo-spec-loop`

Want `/spec` instead? Copy `commands/spec.md` into this project’s `.claude/commands/spec.md`.

## Other tools

Cursor: install from this repo (`.cursor-plugin/`).

Anything else (Codex, Gemini, Aider, Copilot, plain ChatGPT): copy `templates/next.md` to `.specs/next.md`, paste `rules/spec-loop.mdc` into your `AGENTS.md`. Optionally wire `hooks/solo_spec_gate.py` into a pre-write hook if your tool has one.

## What's in the repo

```text
hooks/solo_spec_gate.py    the portable gate (~160 lines stdlib Python)
templates/next.md          the spec template
commands/spec.md           slash command (Claude Code: `/solo-spec-loop:spec …`)
rules/spec-loop.mdc        Cursor always-apply rule
skills/solo-spec/          Claude Code skill
tests/                     stdlib-only tests for the gate
```

## Tests

```bash
python3 tests/test_solo_spec_gate.py
```

## What this is not

Not [Spec Kit](https://github.com/github/spec-kit). Not [GSD](https://github.com/gsd-build/get-shit-done). Not [OpenSpec](https://github.com/Fission-AI/OpenSpec). No constitution, no per-feature folders, no multi-agent orchestration. If you want any of that, pick one of those.

## License

MIT.
