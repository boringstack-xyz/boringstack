# Generated OpenAPI client

`schema.d.ts` is **generated**. Never edit it by hand.

The generator is `scripts/codegen/generate-api.ts`. It reads
api-template's `/swagger/json`, runs `openapi-typescript`, and writes
`src/lib/api/schema.d.ts`. The path is fixed because the typed
`apiClient` (built on `openapi-fetch`) imports `paths` from it.

## Regenerating

When api-template changes a route shape:

1. Boot api-template (typically via
   `../../../../infra/compose/compose/dev.sh up -d`).
2. From this repo's root:
   `OPENAPI_URL=http://localhost:3000/swagger/json pnpm generate:api`.
3. Commit the diff.

## Drift gates

Drift between the checked-in `schema.d.ts` and the live API is enforced
in three places:

- **ui-template pre-push hook**: runs `generate:api:check` if api is
  reachable on `:3000` at push time.
- **api-template `openapi-drift` CI workflow**: boots api-template,
  checks out ui-template alongside, runs `pnpm generate:api:check`. Fails
  the api-template PR that introduced the drift.
- **infra `full-stack-smoke` workflow**: integration-tests the schema
  on every infra push.

If the api-template `openapi-drift` job fails on a PR, the schema must
be regenerated and committed to ui-template's main BEFORE the
api-template PR can merge.

## apiClient

`apiClient` reads `paths` from this schema. A compile-time error here
means the call site references a path that no longer exists or sends a
body shape the API doesn't accept. Regenerate the schema first; only
fix the call site if it's the call site that's wrong.
