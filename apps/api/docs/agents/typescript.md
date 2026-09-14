# TypeScript hard rules

Read when ESLint pushes back on a type assertion, a `!`, or an
`any`. All rules below are enforced by
`typescript-eslint/strict-type-checked`.

- **No `any`** — use `unknown`, narrow with type guards.
- **No `as`** — only `as const` permitted; use type guards or generics.
- **No non-null `!`** — refine with `if (x !== null) {}`.
- **Errors are `unknown`** in catch — narrow via `instanceof Error`
  or use `getErrorMessage(error)`.
- **Interfaces** prefixed `I` (e.g. `IUser`, `IAuthOptions`).
- **Exported functions** have explicit return types.
- **Top-level constants** are `UPPER_CASE`.
- **No single-letter identifiers** in `src/**/*.ts` (`id-length` rule;
  exceptions: `_`, `i`, `j`, `k` for loop indices).
- **No magic UPPER_SNAKE string literals** in `switch` cases or `===` /
  `!==` comparisons. Reference a typed constants object (e.g.
  `ElysiaErrorCodes.NOT_FOUND`, `AUDIT_ACTIONS.NOTIFICATION_STATUS_UPDATED`).
- **No inline `eslint-disable`** comments. Adjust `eslint.config.js`
  with a per-file override and a justification.

## Portable API schemas

The TypeBox schemas in `*.schemas.ts` are published as OpenAPI and turned
into the UI client's types, so three Elysia shapes that validate fine come
out wrong on the other side. `elysia/portable-schema-types` reports them.

| Write                                                      | Not                          | Because                                                                                                                              |
| ---------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Type.Integer()` from `@sinclair/typebox`                  | `t.Integer()`                | Elysia's `t.Integer` coerces from strings and publishes as `anyOf [string, integer]`; the client types the field `string \| number`. |
| `t.UnionEnum([...STATUSES])` or spelled-out `t.Literal()`s | `t.Union(STATUSES.map(...))` | `.map()` returns an array, not a tuple, so the static type collapses to `undefined`.                                                 |
| `t.Array(...)` or a named `t.Object(...)`                  | `t.Tuple([...])`             | OpenAPI 3.0 has no tuple; the client widens it to `T[]` and the two "same" types stop being assignable.                              |

`t.Numeric()` remains correct for query and path parameters, which arrive
as strings, and `src/config/env/schema.ts` keeps `t.Integer()` because
env parsing wants the coercion.
