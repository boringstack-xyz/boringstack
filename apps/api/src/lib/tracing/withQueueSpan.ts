import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { Job } from "bullmq";

import { getErrorMessage } from "../errors";

const tracer = trace.getTracer("boringstack-api/queue");

/*
 * Wrap a BullMQ job processor in an OpenTelemetry span so queue work
 * shows up in Tempo (and in any other trace backend wired up via the
 * OTLP exporter). Each invocation gets a span named
 * `queue.<name>.process` with messaging.* attributes Grafana's Tempo
 * Explore can filter on (system, destination, message id, attempt).
 *
 * Use inside a worker's processJob method:
 *
 *   private async processJob(job: Job<X>): Promise<void> {
 *     return withQueueSpan("email-delivery", job, async () => {
 *       // existing body
 *     });
 *   }
 *
 * Exceptions are recorded on the span before being re-thrown so BullMQ
 * sees the failure exactly as it did before.
 */
export const withQueueSpan = async <T>(
  queueName: string,
  /*
   * Only the fields the span attributes read — keeps full BullMQ jobs
   * assignable while letting tests pass a structural stub without casts.
   */
  job: Pick<Job, "id" | "name" | "attemptsMade">,
  handler: () => Promise<T>
): Promise<T> =>
  tracer.startActiveSpan(
    `queue.${queueName}.process`,
    {
      attributes: {
        "messaging.system": "bullmq",
        "messaging.destination.name": queueName,
        "messaging.message.id": job.id ?? "",
        "messaging.bullmq.job.name": job.name,
        "messaging.bullmq.job.attempt": job.attemptsMade + 1,
      },
    },
    async (span) => {
      try {
        const result = await handler();

        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: getErrorMessage(error),
        });

        if (error instanceof Error) {
          span.recordException(error);
        }

        throw error;
      } finally {
        span.end();
      }
    }
  );
