# Patterns — index

**[AGENT_CONTRACT.md](AGENT_CONTRACT.md)** is the rulebook (merge bar,
suffix rules, ESLint plugin map). This file is a navigation index to
focused pattern guides under [`docs/agents/`](docs/agents/).

`bun run check` is the oracle. If anything below disagrees with what
`check` says, the lint config wins — flag the drift.

## Deep dives

| When you're doing this                                                         | Read this                                             |
| ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Starting the API, switching host / container, chasing a "missing module" error | [dev-environment](docs/agents/dev-environment.md)     |
| Adding a new resource folder under `src/api/<name>/`                           | [resource-files](docs/agents/resource-files.md)       |
| ESLint pushing back on `!`, `any`, magic strings, single-letter ids            | [typescript](docs/agents/typescript.md)               |
| Touching schema, writing service queries, transactions                         | [drizzle](docs/agents/drizzle.md)                     |
| Throwing in a service; wrapping a caught exception                             | [errors](docs/agents/errors.md)                       |
| Login flows, OAuth providers, role gates                                       | [authentication](docs/agents/authentication.md)       |
| Writing a `logger.*` call; PII masking                                         | [logging](docs/agents/logging.md)                     |
| Writing a mutating service method                                              | [audit-log](docs/agents/audit-log.md)                 |
| Reading or writing to Valkey                                                   | [cache](docs/agents/cache.md)                         |
| Adding a BullMQ job; touching `src/queues/`                                    | [queues](docs/agents/queues.md)                       |
| Touching Stripe webhooks, plan IDs, `billing.service.ts`                       | [billing](docs/agents/billing.md)                     |
| Adding a config knob (`schema.ts`, `.env.example`)                             | [environment](docs/agents/environment.md)             |
| Writing tests, fixing failures, adding a truncate target                       | [testing](docs/agents/testing.md)                     |
| Adding an allowlist entry; debugging a security workflow                       | [security-pipeline](docs/agents/security-pipeline.md) |
| Starting a backend feature (`/build-feature`, `/add-audit-event`, etc.)        | [feature-skills](docs/agents/feature-skills.md)       |
| Reviewing a diff or running instance for security                              | [security-skills](docs/agents/security-skills.md)     |
