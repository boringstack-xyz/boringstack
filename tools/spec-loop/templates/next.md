---
status: draft # draft | approved
slice: ""
approved_at: ""
---

# Next slice

## Problem
One or two sentences in problem-only language (why this matters). No solution words (button, API, email, page).

## Purpose
Who is served, and what should become true? One line of parent context (outcome/capability) if helpful.

## One-session exit condition
The smallest observable outcome that makes this session worth it.

- [ ]

## Design decisions
Visible choices made for this slice (not open requirements).

-

## Event sketch
One trigger → one observable result. Use this or Rules/examples below, not both in depth.

- Trigger / command:
- State or rule that changes:
- Observable result / event:
- Who sees it:

## Rules / examples (optional)
Max 2 rules, 1 example each. Plain Given/When/Then; delete if Event sketch is enough.

```
Rule:
  Example:
    Given
    When
    Then
```

## Slice
What we will build now, in the smallest vertical cut.

-

## Questions that matter
Only questions that change behavior, UX, data, security, scope, or verification.

- [ ]

## Assumptions
Defaults we proceed with unless corrected.

-

## Verification contract
Executable guardrails. Acceptance check verifies outcome, not implementation path.

- Must remain true (invariants / must not regress):
- Must not happen (≥1 explicit negative case):
- Acceptance check (runnable command, not prose):
  - e.g. `bun test path/to.test.ts -t "case name"`

## Spec smells (check before approve)
- [ ] Not vague — one trigger, one observable result, no open guesses
- [ ] Not kitchen sink — one vertical slice, not many concerns welded
- [ ] Not lossy — negative cases and edges covered in contract
- [ ] Not immortal ticket — living spec, not a one-off task dump
- [ ] Not PRD-as-spec — design decisions recorded, not problem-only prose

## Not doing
Protect the slice from becoming a project.

-

## Files likely touched
If this list explodes, the slice is too big.

-

## Build notes
3-5 bullets after building: changed, checked, learned, follow-up.
