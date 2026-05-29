import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

import { env } from "../env";

/*
 * Distributed tracing via OpenTelemetry.
 *
 * Spans flow: this SDK collects them in-process and ships via OTLP/HTTP to
 * Tempo (the trace backend bundled in the observability compose stack).
 * Grafana queries Tempo by trace_id; the same trace_id is stamped on every
 * Pino log record (see config/logger/logger.ts) and on every Sentry/GlitchTip
 * error event, so a slow request found in metrics can be pivoted to its
 * trace and the logs around it without leaving Grafana.
 *
 * Initialised once at boot, before any instrumented code runs. The auto-
 * instrumentations patch HTTP / undici (outgoing fetch) / ioredis (Valkey +
 * BullMQ) / fs / dns / and a handful more — see
 * @opentelemetry/auto-instrumentations-node for the full list.
 *
 * Not auto-instrumented: postgres-js (Drizzle's underlying driver — no
 * upstream OTel instrumentation exists for it). Wrap DB calls manually
 * with `withDbSpan` from lib/tracing when you want them visible.
 *
 * No-op when OTEL_EXPORTER_OTLP_ENDPOINT is empty (the default outside of
 * compose), so unit tests + standalone runs don't try to export to a host
 * that isn't there.
 */
let sdk: NodeSDK | null = null;

export const initializeOpenTelemetry = (): void => {
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT === "") {
    return;
  }

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: env.APP_NAME,
      "deployment.environment": env.NODE_ENV,
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        /*
         * Disable file-system instrumentation: it generates an enormous
         * volume of spans for normal Node operations and drowns out the
         * application signal. Disable dns for the same reason.
         */
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
      }),
    ],
  });

  sdk.start();
};

/*
 * Best-effort shutdown — called from the process exit handlers so
 * in-flight spans get a chance to flush before the runtime exits.
 */
export const shutdownOpenTelemetry = async (): Promise<void> => {
  if (sdk === null) {
    return;
  }

  await sdk.shutdown();
};
