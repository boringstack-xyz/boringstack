# API client

Read when calling the backend, regenerating types, or wondering why
`fetch` is lint-banned.

All HTTP goes through `@/lib/api/client.ts`. The client is built with
[`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) on top of
types generated from the api-template's OpenAPI spec — paths,
request bodies, and response shapes are all inferred from
`src/lib/api/schema.d.ts`.

```ts
import { apiClient } from "@/lib/api/client";

// Path is autocompleted, response is typed from the spec.
const { data } = await apiClient.GET("/auth/me");
//      ^? { user: { id, email, name, role, createdAt } } | undefined

// Request body is type-checked against the OpenAPI requestBody.
const { data: login } = await apiClient.POST("/auth/login", {
  body: { email, password }
});
```

Non-2xx responses throw `ApiError` (`.status`, `.code`,
`.fieldErrors`, `.requestId`, plus `isUnauthorized` / `isValidation`
/ `isServer` flags) via the `throwOnError` middleware in
`src/lib/api/openapi.ts`. TanStack Query catches the throw —
`useQuery` / `useMutation` `isError` and `onError` work as expected.

## Keeping types in sync

```bash
# In one terminal: boot the api-template
cd ../api-template && bun run dev

# In another terminal: regenerate the UI types
pnpm generate:api
```

This rewrites `src/lib/api/schema.d.ts`. Commit the change alongside
whatever feature work consumes the new endpoints. CI's
`pnpm generate:api:check` is only meaningful when the API is
reachable during the run.

**Never call `fetch` or `axios` directly.** Lint fails the PR.
Routes that aren't in the spec yet are forbidden — add them to the
API first, then regenerate.

## What about Zod schemas?

Zod schemas (`*.schemas.ts`) are for **runtime validation at the
input boundary** — primarily forms
(`zodResolver(loginInputSchema)` in `useForm({...})`). They are
_not_ the source of truth for API types; that lives in the OpenAPI
spec. The two coexist:

- OpenAPI types → request/response _shape_ (compile-time)
- Zod schemas → field-level validation rules (runtime,
  user-visible errors)
