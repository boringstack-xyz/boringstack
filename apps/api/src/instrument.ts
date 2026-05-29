/*
 * Bootstrap entry-point for the OpenTelemetry SDK.
 *
 * Auto-instrumentations patch the modules they cover (http, undici,
 * ioredis, ...) at *import time*. That patching must happen before any
 * other module imports those targets, or it won't take effect. The
 * cleanest enforcement of "run this first" in JavaScript is a side-
 * effect import placed at the top of src/index.ts — this file is that
 * side effect.
 */
import { initializeOpenTelemetry } from "./config/otel";

initializeOpenTelemetry();
