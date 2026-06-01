# Queues (BullMQ)

Read this when adding a new background job under `src/queues/**`.

## Folder anatomy

Each job lives at `src/queues/<job-name>/`:

```
email-delivery/
├── email-delivery.queue.ts     # Queue() + name constant
├── email-delivery.worker.ts    # Worker() + processor
├── email-delivery.setup.ts     # called from setup-queues.ts
└── email-delivery.types.ts
```

## Lint contract

The `bullmq` plugin requires:

- Workers `close()` on shutdown.
- Listen for `failed`.
- Use a constant job name (no `crypto.randomUUID()` — must dedupe on
  retry).
- Queues set `removeOnComplete` / `removeOnFail` / `attempts`.

Lifecycle is centralized in `src/queues/QueueManager.ts` and wired into
shutdown via `src/config/error-handlers.ts`.
