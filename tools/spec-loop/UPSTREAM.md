# Upstream

This directory is a vendored copy of
[`agjs/solo-spec-loop`](https://github.com/agjs/solo-spec-loop) (MIT).

## Why vendored

BoringStack treats the spec-loop as a first-class part of the
template, not an external dependency. A forker who clones BoringStack
must get a working spec-loop on disk — no `npm install`, no marketplace
fetch, no Python package — so the artifacts live inside the repo.

## What's here

```text
commands/         slash command (/spec or /solo-spec-loop:spec)
hooks/            gate script + Claude/Cursor hook config
rules/            Cursor always-apply rule
skills/           Claude Code skill
templates/        next.md template
tests/            stdlib-only tests for the gate
.claude-plugin/   plugin manifest (for users who prefer the marketplace path)
.cursor-plugin/   plugin manifest
```

## Keeping it in sync

When upstream lands a fix that matters to BoringStack:

1. From the upstream repo (`~/code/solo-spec-loop` or your clone),
   pin to the tag you want to track.
2. Copy the artifacts back, excluding `.git/`, `.venv*/`, and any
   CI scaffolding that is upstream-specific:

```bash
SRC=/path/to/solo-spec-loop
DST=tools/spec-loop
cp -r "$SRC"/{commands,hooks,rules,skills,templates,tests,README.md} "$DST"/
cp -r "$SRC"/.claude-plugin "$SRC"/.cursor-plugin "$DST"/
```

3. Diff `tools/spec-loop/` against the previous state, run the gate
   tests, and commit with the upstream commit SHA in the message.

The plan is to keep this manual until it diverges. If the BoringStack
copy ever needs project-specific changes (e.g. acceptance-check
examples that reference `apps/api` / `apps/ui`), keep them inside
`tools/spec-loop/` and patch them on top of each upstream pull.

## License

The vendored copy retains its upstream MIT license. Do not strip the
license header from `LICENSE` (when present) or rewrite history that
removes attribution.
