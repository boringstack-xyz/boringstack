# Queues (BullMQ)

Read this when adding a new background job under `src/queues/**`.

## Folder anatomy

Each job lives at `src/queues/<job-name>/`:

```
email-delivery/
├── email-delivery.queue.ts     # Queue() + name constant
├── email-delivery.worker.ts    # Worker() + processor
├── email-delivery.setup.ts     # called from config/setup/setup-queues.ts
└── email-delivery.types.ts
```

## Lint contract

The `bullmq` plugin requires:

- Workers `close()` on shutdown.
- Listen for `failed`.
- Use a constant job name (no `crypto.randomUUID()` — must dedupe on
  retry).
- Queues set `removeOnComplete` / `removeOnFail` / `attempts`.

Lifecycle is centralized in `src/queues/queue-manager.ts` and wired into
shutdown via `src/config/error-handlers/error-handlers.ts`.

## Registration checklist

1. Add constants, job types, queue, worker, setup and a public `index.ts` under
   `src/queues/<name>/`. Export the setup and types from `src/queues/index.ts`.
2. Construct the pair in `src/config/setup/setup-queues.ts` and pass both to
   `QueueManager`. Respect `QUEUES_ENABLED`; optional jobs need a deliberate
   disabled-path result.
3. Extend `src/queues/queue-manager.ts`: constructor input, enqueue method,
   statistics and graceful close. Keep job defaults in the queue constants.
4. Wire the producer through the manager. Define retry idempotency at the durable
   side-effect boundary; a stable job name alone does not deduplicate job IDs.
5. Add tests for enqueue options, processing failures, repeated delivery and
   lifecycle cleanup. If configuration is added, update env schema/validation,
   `.env.example`, Compose and the scaffold manifest together.

The reference is `email-delivery`; compare every registration above when adding
a queue. Feature-specific component registries are product code and need their
own checklist rather than a global template exemption.
