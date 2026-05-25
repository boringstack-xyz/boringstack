# Building features

Read when starting a UI feature or a vertical slice.

Project-owned skills live in `.claude/skills/`:

| Skill               | Use when                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `/build-feature`    | Broad — any new UI feature (page, component, form, list view, API integration). Six-checkpoint loop.                              |
| `/add-full-feature` | Cross-repo — vertical slice across api-template + ui-template (api `/build-feature` → `pnpm generate:api` → ui `/build-feature`). |

Both skills are read-only — never commit, push, or open PRs. They
stop at the merge gate (`pnpm validate`) with a diff summary so the
user owns the commit boundary.

For narrow backend-only tasks (wiring one audit event, adding an
email template, scaffolding a notification event), the corresponding
skills live in **api-template**'s `.claude/skills/` and are invoked
from that repo.
