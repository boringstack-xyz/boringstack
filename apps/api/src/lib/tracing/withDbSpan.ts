import { SpanStatusCode, trace } from "@opentelemetry/api";

import { getErrorMessage } from "../errors";

const tracer = trace.getTracer("boringstack-api/db");

/*
 * Wrap a Drizzle query (or any async DB call) in an OpenTelemetry span
 * so the duration becomes a child of the current request span — visible
 * as a row in the Tempo trace waterfall under the parent HTTP span.
 *
 * postgres-js has no upstream OTel auto-instrumentation, so DB query
 * spans are opt-in at the call site. Use this for hot paths and code
 * you're benchmarking; the trace will pinpoint slow queries that look
 * like "anonymous internal time" inside the parent request span without
 * it.
 *
 * Usage:
 *
 *   const user = await withDbSpan(
 *     "users.findById",
 *     { "db.statement": "select id, email from users where id = $1" },
 *     () => db.query.users.findFirst({ where: eq(users.id, userId) })
 *   );
 *
 * The `attributes` arg follows OTel's db.* semantic conventions
 * (https://opentelemetry.io/docs/specs/semconv/database/) — keep
 * statements parameterised; never put PII or unbounded values in span
 * attributes.
 */
export const withDbSpan = async <T>(
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  handler: () => Promise<T>
): Promise<T> =>
  tracer.startActiveSpan(
    `db.${spanName}`,
    {
      attributes: {
        "db.system": "postgresql",
        ...attributes,
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
