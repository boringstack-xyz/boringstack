# Errors

Read when throwing in a service or wrapping a caught exception.

```ts
import { ApiErrors, getErrorMessage } from "../../lib/errors";

throw ApiErrors.notFound("Ticket");
throw ApiErrors.validation("name is reserved", "name");
throw ApiErrors.unauthorized();

try {
  // ...
} catch (err: unknown) {
  logger.error("Operation failed", {
    event: "x.failed",
    error: getErrorMessage(err),
  });
  throw ApiErrors.internal("Something failed");
}
```

`src/middleware/error-handler.ts` translates `ApiError` → typed JSON
response with the correct HTTP status. `new Error(...)` becomes a
generic 500 — never throw it from a service.

## Wrapping a cause

`ApiError` accepts a `cause`, so the original error stays attached
through the native `Error.cause` chain:

```ts
catch (err: unknown) {
  throw ApiErrors.externalService("Stripe unreachable", { cause: err });
}
```

## Why no per-handler try/catch in routes

Routes have no try/catch on purpose. Services throw `ApiErrors.*`;
Elysia's `.onError()` (wired through `errorHandler`) catches every
exception in one place. Adding handler-local catches duplicates the
work and tends to swallow the typed status.
