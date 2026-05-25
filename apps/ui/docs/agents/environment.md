# Environment

Read when adding a `VITE_*` var or wondering why `import.meta.env`
is lint-banned.

`src/lib/env/schema.ts` is the source of truth.
`src/lib/env/index.ts` exports a validated `env` singleton. Read
every var via `env.VITE_FOO`.

**Never reach for `import.meta.env` outside `src/lib/env/`.** Lint
fails. Adding a new var = new field in the Zod schema + new line in
`.env.example`.
