# Logging

Read when adding a `logger.*` call or wondering why `console.*` is
banned.

```ts
import { logger } from "@/lib/logger/logger";

logger.info({ event: "auth.login_success", userId });
logger.warn({ event: "api.error_response", status: 500, path });
logger.error({ event: "ui.error_boundary", error });
```

- `event` is required (kebab-case, dot-separated namespace).
- Sensitive keys (`password`, `token`, `accessToken`,
  `authorization`, etc.) are auto-redacted by the logger.
- No `console.*` anywhere except `src/lib/logger/logger.ts`, build
  configs, `scripts/**`, `.storybook/**`, and tests.
