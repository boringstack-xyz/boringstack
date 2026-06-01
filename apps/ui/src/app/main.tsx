import { StrictMode } from "react";

import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";

import { env } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { logger } from "@/lib/logger/logger";

import "@/assets/css/tailwind.css";

import { App } from "./App";

if (env.VITE_SENTRY_DSN !== "") {
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.MODE,
    /*
     * 0 keeps Sentry error-capture-only on the browser side. `browserTracingIntegration`
     * stays loaded because it's what writes the W3C `traceparent` header on
     * outbound `/api/*` fetches — the API's OpenTelemetry SDK reads that
     * header to continue the trace server-side and ship spans to Tempo. With
     * rate 0 the browser doesn't send transactions to GlitchTip but still
     * generates trace ids, so a browser-raised error event still carries
     * `trace_id` for the GlitchTip → Tempo pivot.
     */
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.browserTracingIntegration()],
    /*
     * Propagate `sentry-trace` + `traceparent` headers only on same-origin
     * API calls. Defaulting to "all origins" would leak the trace id to
     * CDNs and third-party services.
     */
    tracePropagationTargets: ["/api/", /^https?:\/\/[^/]+\/api\//]
  });
}

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);

logger.info({ event: "app.bootstrapped", mode: env.MODE });

/*
 * Register the Web Push service worker. Best-effort: failure here doesn't
 * block the app — the SettingsPage reports "not supported" / "blocked" via
 * the useWebPush hook. Only attempt registration in browsers that support
 * service workers (Safari < 16 doesn't ship Push API + VAPID).
 */
if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
    logger.warn({
      event: "service_worker.register_failed",
      error: getErrorMessage(error)
    });
  });
}
