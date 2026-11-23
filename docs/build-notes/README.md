# Build notes

One short note per build: where each layer of a feature lives, the order that
worked, what cost time, and which checks to copy. The next session that builds
something similar reads these first (`.claude/skills/build-notes/SKILL.md`).

- Write a note at hand-over, from `.claude/skills/build-notes/template.md`.
- One file per feature, named for the feature (`fiscal-calendar.md`), not for
  the issue.
- Each note starts with a front matter block: `kind`, `summary`, `keywords`,
  `built`. Keep it under about 120 lines.
- Never put secrets, customer data or a person's name in a note.

The index is the directory itself: `head -n 6 docs/build-notes/*.md`.
