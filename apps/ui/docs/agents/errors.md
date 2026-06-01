# Errors

Read when catching an API error in a hook, wiring an error boundary,
or writing client-side validation.

- **Server-returned errors** → `ApiError`. Branch on
  `error.isUnauthorized` / `error.isValidation` / `error.isServer`.
  Map field errors via `applyServerErrors`.
- **Render errors** → caught by `<ErrorBoundaryProvider>` at the app
  root. Sentry is wired in `main.tsx` (`VITE_SENTRY_DSN`).
- **Validation errors** → Zod schema in `*.schemas.ts`. Don't write
  parallel validators — the same Zod schema feeds `useForm` via
  `zodResolver`.
