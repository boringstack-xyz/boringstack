## Summary

<!-- 1–3 bullets. What changed and why. -->

## Test plan

- [ ] `bun run validate` clean locally (typecheck + lint + tests)
- [ ] Integration tests run: `cd ../../infra/compose/compose && ./dev.sh up`,
      `bun run db:migrate`, `bun test`

## Conventions

- [ ] Resource files follow the `*.{routes,service,schemas,types,constants}.ts` split
- [ ] Services throw `ApiErrors.*`, never `new Error(...)`
- [ ] No `any`, no `as` (only `as const`), no `!`, no inline `eslint-disable`
- [ ] New env vars added to `src/config/env/schema.ts` + `validate.ts` + `.env.example`
- [ ] New routes mounted in `src/config/routes.ts` + `app.ts` + Swagger tag in `swagger.ts`
- [ ] Mutating service methods record an audit event (`auditLogService.record(...)`)
- [ ] Tests added/updated for changed behavior
