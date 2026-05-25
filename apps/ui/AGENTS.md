# Patterns — index

**[AGENT_CONTRACT.md](AGENT_CONTRACT.md)** is the rulebook (merge bar,
suffix rules, ESLint plugin map). This file is a navigation index to
focused pattern guides under [`docs/agents/`](docs/agents/).

`pnpm validate` is the oracle. If anything below disagrees with what
`validate` says, the lint config wins — flag the drift.

## Deep dives

| When you're doing this                                                    | Read this                                             |
| ------------------------------------------------------------------------- | ----------------------------------------------------- |
| Starting the SPA, switching host / container, chasing a stale-module boot | [dev-environment](docs/agents/dev-environment.md)     |
| Creating a new component, splitting a growing one                         | [component-anatomy](docs/agents/component-anatomy.md) |
| Writing JSX (computation, handlers, `className`, a11y)                    | [jsx-rules](docs/agents/jsx-rules.md)                 |
| Picking where new state lives; wiring a query / store                     | [state-management](docs/agents/state-management.md)   |
| Adding a form, mapping server errors to RHF                               | [forms](docs/agents/forms.md)                         |
| Calling the backend, regenerating types, OpenAPI vs Zod                   | [api-client](docs/agents/api-client.md)               |
| Adding a `logger.*` call; `console.*` rules                               | [logging](docs/agents/logging.md)                     |
| Adding a `VITE_*` var; `import.meta.env` rules                            | [environment](docs/agents/environment.md)             |
| Adding user-facing strings, errors, toasts, aria-labels                   | [i18n](docs/agents/i18n.md)                           |
| Adding a route or wrapping it in auth                                     | [routing](docs/agents/routing.md)                     |
| Writing tests, picking a suite, mirror-source rule                        | [testing](docs/agents/testing.md)                     |
| Catching `ApiError`, error boundaries, Sentry                             | [errors](docs/agents/errors.md)                       |
| Adding a shadcn primitive; `@theme` token wiring                          | [shadcn](docs/agents/shadcn.md)                       |
| Adding an allowlist entry; debugging a security workflow                  | [security-pipeline](docs/agents/security-pipeline.md) |
| Starting a UI feature or a vertical slice (`/build-feature`)              | [feature-skills](docs/agents/feature-skills.md)       |
| Reviewing a diff or running instance for security                         | [security-skills](docs/agents/security-skills.md)     |
