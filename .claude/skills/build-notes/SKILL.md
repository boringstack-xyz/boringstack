---
name: build-notes
description: How earlier builds of this repository were done, one short note per build, so the next session starts from a map instead of searching the code. Use before planning or building any feature, endpoint, page, job or data change, to find similar past work; and at hand-over, to write this build's note. Notes live in docs/build-notes/.
---

# Build notes

We build the same kinds of things again and again. Every build leaves a short
note in `docs/build-notes/`: where each layer lives, the order that worked,
what cost time, and which checks to copy. A session that reads the right note
first skips most of its searching.

## Before you plan: look up

1. List the notes: `head -n 6 docs/build-notes/*.md`. Each starts with its
   `kind`, a one-line `summary` and `keywords`.
2. Read every note of the same kind, or about the same pages, endpoints or data.
   Use its "Where it lives" as your starting map, and its checks as templates.
3. A note is a map, not the truth. It records the code as it was. Open each file
   it names before you rely on it. If a path moved, fix the note in your own
   change.
4. Say in the plan which notes you used. If none fits, say so: that is the
   reason to write a good one at the end.

## At hand-over: write this build's note

Write it before the hand-over, and link it in the verification record's
"Build note" section (its path, e.g. `docs/build-notes/fiscal-calendar.md`), or
write "Nothing to learn: <why>" there for a change too small to teach anything
(a copy fix, a one-line bug).

1. Start from `.claude/skills/build-notes/template.md`. The file name names the
   feature in a few words, not the issue id. If a note already covers the same
   feature, update that note instead.
2. Write it for the next session, which knows this repository but not this
   feature:
   - real paths, with what each file does;
   - the order that worked, and why;
   - what cost the most time, and the dead ends, so nobody repeats them;
   - the checks written, so they can be copied;
   - what only a person gave (accounts, consent, product decisions).
   Keep it under about 120 lines. Leave out what the code or the pull request
   already says plainly.
3. Never put secrets, customer data, or a person's name in a note.
4. Commit it with the change it describes.

## When a kind repeats: make it a playbook

When the second or third note of one kind appears (two settings pages, three
endpoints), the shared steps belong in a skill of their own
(`.claude/skills/<kind>/SKILL.md`), with a description written as the request a
person would make ("add a settings page"). Each note then keeps only what is
specific to its feature and points at the playbook.
