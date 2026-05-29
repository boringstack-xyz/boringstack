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
