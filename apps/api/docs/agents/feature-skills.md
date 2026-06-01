# Building features

Read when starting any feature work — pick the right skill by scope.

Project-owned skills live in `.claude/skills/`:

| Skill | Use when |
| --- | --- |
| `/build-feature` | Broad — any new backend feature (resource, endpoint, job, notification event, ACL flag). Six-checkpoint loop. |
| `/add-audit-event` | Narrow — wiring ONE `auditLogService.record(...)` call into an existing service. |
| `/add-email-template` | Narrow — a new transactional email (Handlebars + send fn + Mailpit preview). |
| `/add-notification-event` | Narrow — wraps `bun run new:notification-event` with dedup strategy + i18n + render fns. |
| `/add-full-feature` | Cross-repo — vertical slice across apps/api + apps/ui (api `/build-feature` → `bun run generate:api` → ui `/build-feature`). |

All five skills are read-only — none commit, push, or open PRs. They
stop at the merge gate (`bun run validate`) with a diff summary so the
user owns the commit boundary.
