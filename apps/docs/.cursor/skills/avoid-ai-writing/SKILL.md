---
name: avoid-ai-writing
description: >-
  Audit and rewrite BoringStack docs and repo prose to remove AI writing patterns
  ("AI-isms"). Use for Starlight MDX under .github/src/content/docs, profile/README,
  root README, or when asked to remove AI-isms, clean up AI writing, or make copy
  sound less machine-generated.
---

# Avoid AI writing (audit and rewrite)

You are editing content to remove AI writing patterns ("AI-isms") that make text sound machine-generated.

The user will provide a piece of writing (or a path). Your job is to:

1. **Audit it:** identify every AI-ism present, citing the specific text.
2. **Rewrite it:** return a clean version with all AI-isms removed.
3. **Show a diff summary:** briefly list what you changed and why.

---

## BoringStack docs site (this monorepo)

When the scope is **this documentation site** or its siblings:

| Kind | Typical paths |
|------|----------------|
| Starlight pages | `.github/src/content/docs/**/*.mdx` |
| Site config copy | `.github/astro.config.mjs` (e.g. `description`, sidebar labels) |
| Org profile | `.github/profile/README.md` |
| Monorepo index | `README.md` at repo root |
| Deploy notes | `.github/DEPLOY.md` |

**MDX frontmatter:** `title` and `description` are YAML. If the rewritten `description` contains a **colon** followed by space (`Key: value` inside the string), **wrap the whole value in double quotes** so `npm run build` does not fail with a YAML parse error.

**Do not break:** Starlight component imports (`Aside`, `Steps`, `Card`, `FileTree`, etc.), code fences, tables, or `mermaid` blocks. Only change prose and safe frontmatter strings.

**Verify when editing many pages:** from `.github/`, run `npm run build`.

---

## What to remove or fix

### Formatting

- **Unicode em dash (U+2014) and en dash abuse:** Replace with commas, periods, parentheses, or two sentences. Target: zero em dashes in shipped docs. (CLI flags like `npm run build -- --help` are fine.)
- **Bold overuse:** Strip bold from most phrases. At most one bolded phrase per major section, or none. Lead with the important word in plain text instead.
- **Emoji in headers:** Remove. No `## 🚀 What this means`. Exception: social-only copy, one or two emoji at end of line, never mid-sentence.
- **Excessive bullet lists:** Turn bullet walls into prose where they are not true lists (steps, parameters, comparisons stay as lists).

### Sentence structure

- **"It's not X, it's Y" / "This isn't about X, it's about Y":** Rewrite as a direct positive statement. At most one such contrast per piece, only if it earns its keep.
- **Hollow intensifiers:** Cut `genuine`, `real` (as in "a real improvement"), `truly`, `quite frankly`, `to be honest`, `let's be clear`, `it's worth noting that`. State the fact.
- **Hedging:** Cut `perhaps`, `could potentially`, `it's important to note that`, `to be clear`. Say the point.
- **Missing bridge sentences:** Paragraphs should connect; add a short bridge if blocks are interchangeable.
- **Rule of three overload:** Vary counts (two, four, or one full sentence). Cap triads of adjectives.

### Structural issues

- **Uniform paragraph length:** Mix short punchy graphs with longer explanatory ones on purpose.
- **Formulaic openings:** Replace "In today's rapidly evolving…" style with the actual news or task.
- **Suspiciously clean grammar:** Keep deliberate fragments, sentences starting with "And" / "But," or light comma splices if they match a human voice.

For vocabulary tables and extra categories, see [PATTERNS.md](PATTERNS.md).

---

## Output format

Return your response in four sections:

**1. Issues found**  
Bulleted list of every AI-ism, with quoted offending text.

**2. Rewritten version**  
Full rewritten content. Preserve structure, intent, and technical details. Change only what the guidelines require.

**3. What changed**  
Short summary of meaningful edits (not a word-by-word ledger).

**4. Second-pass audit**  
Re-read section 2. Note any surviving tells; fix and state what changed. If clean, say so.

---

## Tone calibration

Aim for copy that sounds written by a careful engineer: direct, specific, confident without preening.

1. **Vary sentence length:** mix short and long; fragments are fine.
2. **Be concrete:** names, numbers, paths, commands, version hints.
3. **Have a voice:** first person or clear editorial "we" where it fits BoringStack docs.
4. **Cut false neutrality:** if the doc takes a stance (e.g. sibling repos vs monorepo), say it plainly.
5. **Earn emphasis:** show why something matters; do not label it "interesting."

If the draft is already strong, say so and touch only what still violates the list above.

### When to rewrite from scratch vs patch

If you see 5+ flagged vocabulary hits across categories, 3+ pattern categories, and flat rhythm, patching phrases will not work. Say so: one-sentence core message, then rebuild.

---

## Developer audience (BoringStack docs)

All user-facing copy on the docs site assumes the reader **ships code**: repos, env vars, CI, Docker, HTTP, git.

1. **Lead with mechanism:** file path, command, port, env var, or lint rule before any "why."
2. **Ban pitch patterns:** `try it`, `company app`, `product spine`, `just works`, `payoff`, `noble`, `deadline-proof` without citing a rule or command.
3. **Ban founder/PM framing on the homepage and generic intros:** `first customers`, `token budget` (keep agent-context language only on pages about AI workflows, e.g. `architecture/agent-docs.mdx`).
4. **Eyebrows are section labels, not slogans:** prefer `Auth`, `Compose overlays`, `Stripe webhooks` over `Payment Spine`, `Ship shape`, `API product spine`.
5. **CTAs are actions:** `Quickstart`, `View on GitHub`, `Run locally`, not `Start the stack` or `Start with the bet`.
6. **Fit-check tables** (Why BoringStack): state technical constraints (runtime ownership, contract shape), not "good fit if you're building a SaaS."
7. **Do not count repos:** say UI, API, infra, or "the templates". Never "three repos", "four templates", or similar counts that break when the org grows.
