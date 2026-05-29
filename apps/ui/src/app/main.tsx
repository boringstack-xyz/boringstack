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
    tracesSampleRate: env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: env.PROD ? 0.0 : 0.0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.browserTracingIntegration()],
    /*
     * Propagate `sentry-trace` + `traceparent` headers only on same-origin
     * API calls. The API's Pino logger picks up the trace id via its
     * Sentry mixin, so a UI-originated request creates a single trace
     * spanning browser → API → Postgres. Defaulting to "all origins"
     * would leak the trace id to CDNs and third-party services.
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
