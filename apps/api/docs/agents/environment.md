# Environment variables

Read this when adding or reading any env var.

## Single source of truth

`src/config/env/schema.ts` is the single source of truth. Add a key
there + in `validate.ts`'s `readRaw()` + in `.env.example`.

The `env-access` plugin blocks raw `process.env.X` outside
`src/config/env/**` and catches typos against the schema.

```ts
import { env } from "../../config/env";
const port = env.PORT;
```

## Boot-time validation

Process refuses to start if required vars are missing or malformed
(see SECURITY.md → "Enforced at boot"). New required vars need a
schema entry, a `.env.example` entry with a sensible default, and a
test if the validation logic is non-trivial.
