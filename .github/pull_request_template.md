## Summary

<!-- 1–3 bullets. What changed and why. -->

## Test plan

- [ ] `bun run check` (or `bun run check:full` for the cross-app pass) from the repo root
- [ ] Stack smoke if compose/infra touched: `cd infra/compose/compose && ./dev.sh up`

### App merge bars

| Area | Command |
|------|---------|
| API | `cd apps/api && bun run validate` |
| UI | `cd apps/ui && bun run validate` |
| Docs | `cd apps/docs && bun run build:ci` |
| Repo drift | `bun run check` (from repo root) |

## Conventions

- [ ] No `any`, no blind `as`, no `!`
- [ ] New env vars in schema + `.env.example` (+ SECURITY.md when relevant)
- [ ] Tests updated for changed behavior

## Screenshots

<!-- Required for UI changes. -->
