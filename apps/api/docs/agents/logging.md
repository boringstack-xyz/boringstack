# Logging

Read this when adding a new `logger.*(...)` call or an `event:` name.

## Required event field

`structured-logging/require-event-field` requires every `logger.*` call
to carry an `event:` key (a stable dotted identifier you can filter
on):

```ts
logger.info("User registered", {
  event: "auth.register.success",
  userId: user.id,
  email: maskEmailForLogging(user.email), // PII must be masked
});

logger.error("Email send failed", {
  event: "email.send.failed",
  error: getErrorMessage(err), // never String(err)
});
```

Sensitive query params (`token`, `password`, `secret`, `key`, `auth`)
are redacted automatically by `request-logger` middleware.
