import { cors } from "@elysiajs/cors";
import { rateLimit } from "elysia-rate-limit";
import { env } from "../env";
import {
  CORS_ALLOWED_HEADERS,
  CORS_MAX_AGE_SECONDS,
  CORS_METHODS,
} from "./security.constants";

/**
 * CORS middleware — mounted only when ALLOWED_ORIGINS is non-empty. In the
 * default same-origin deployment (BoringStack's Traefik path-routes /api/* on
 * the same host that serves the SPA), the browser never sends a cross-origin
 * preflight, so CORS is dead weight. Cross-origin deployments (SPA on a
 * different host) set ALLOWED_ORIGINS and get a mounted middleware here.
 */
export const buildCors = () => {
  if (env.ALLOWED_ORIGINS.length === 0) {
    return undefined;
  }

  return cors({
    origin: env.ALLOWED_ORIGINS,
    credentials: true,
    methods: CORS_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS,
    maxAge: CORS_MAX_AGE_SECONDS,
    aot: true,
  });
};

/**
 * Per-IP rate limit. In-memory by default — fine for single-process
 * deployments. For horizontally-scaled deployments, swap in a Valkey
 * generator (`elysia-rate-limit` accepts a `generator` option).
 *
 * In BoringStack's default deployment, Traefik also rate-limits at the edge
 * of the cluster (see `infra/compose/compose/docker-compose.production-labels.yml`).
 * This app-level limit is the second line of defence.
 */
export const buildRateLimit = () =>
  rateLimit({
    max: env.RATE_LIMIT_MAX,
    duration: env.RATE_LIMIT_WINDOW_MS,
  });

export const buildAuthRateLimit = () =>
  rateLimit({
    max: env.AUTH_RATE_LIMIT_MAX,
    duration: env.AUTH_RATE_LIMIT_WINDOW_MS,
    scoping: "scoped",
    countFailedRequest: true,
  });
