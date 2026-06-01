import { cors } from "@elysiajs/cors";
import { rateLimit, type Generator } from "elysia-rate-limit";
import { env } from "../env";
import { ValkeyRateLimitContext } from "../../lib/rate-limit/valkey-context";
import {
  CORS_ALLOWED_HEADERS,
  CORS_EXPOSED_HEADERS,
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
    exposeHeaders: CORS_EXPOSED_HEADERS,
    maxAge: CORS_MAX_AGE_SECONDS,
    aot: true,
  });
};

/**
 * Rate-limit storage picker. The default `elysia-rate-limit` context is
 * an in-process Map — fine for single-replica deployments, broken once
 * the same logical service runs on two boxes because each replica
 * enforces its own quota. When the deployment opts into the Valkey
 * cache provider, point the limiter at Valkey so the quota is shared.
 *
 * Tests get the in-memory default automatically (CACHE_PROVIDER stays
 * "memory" in `setup-test-env.ts`), so this branch never executes
 * during the test suite.
 */
const buildRateLimitContext = (): ValkeyRateLimitContext | undefined => {
  if (!env.CACHE_ENABLED || env.CACHE_PROVIDER !== "valkey") {
    return undefined;
  }

  return new ValkeyRateLimitContext();
};

/**
 * Rate-limit key generator. The plugin's default uses `server.requestIP`,
 * which behind a reverse proxy is the proxy's IP — every client shares
 * one bucket and a single bad actor locks the whole deployment out.
 *
 * When `TRUST_PROXY=true`, prefer the leftmost entry of
 * `X-Forwarded-For` (closest to the originating client). Without a
 * trusted proxy in front, this header is spoofable, so we only honour
 * it when the operator declared the deploy sits behind one.
 */
interface IIpExtractionInput {
  readonly forwardedFor: string | null;
  readonly socketAddress: string | undefined;
}

/**
 * Picks the leftmost (client-closest) entry of `X-Forwarded-For` when
 * present, otherwise falls back to the socket peer address. Exported
 * for unit testing — production callers go through `buildKeyGenerator`
 * which gates on `TRUST_PROXY`.
 */
export const extractTrustedClientIp = (input: IIpExtractionInput): string => {
  if (input.forwardedFor !== null && input.forwardedFor !== "") {
    const first = input.forwardedFor.split(",")[0]?.trim();

    if (first !== undefined && first !== "") {
      return first;
    }
  }

  return input.socketAddress ?? "";
};

const buildKeyGenerator = (): Generator | undefined => {
  if (!env.TRUST_PROXY) {
    return undefined;
  }

  return (request, server) =>
    extractTrustedClientIp({
      forwardedFor: request.headers.get("x-forwarded-for"),
      socketAddress: server?.requestIP(request)?.address,
    });
};

/**
 * Per-IP rate limit. Storage is in-memory by default and Valkey-backed
 * when the cache provider is set to Valkey (see
 * `buildRateLimitContext`).
 *
 * In BoringStack's default deployment, Traefik also rate-limits at the
 * edge (see `infra/compose/compose/docker-compose.production-labels.yml`).
 * This app-level limit is the second line of defence.
 */
export const buildRateLimit = () => {
  const context = buildRateLimitContext();
  const generator = buildKeyGenerator();

  return rateLimit({
    max: env.RATE_LIMIT_MAX,
    duration: env.RATE_LIMIT_WINDOW_MS,
    ...(context !== undefined && { context }),
    ...(generator !== undefined && { generator }),
  });
};

export const buildAuthRateLimit = () => {
  const context = buildRateLimitContext();
  const generator = buildKeyGenerator();

  return rateLimit({
    max: env.AUTH_RATE_LIMIT_MAX,
    duration: env.AUTH_RATE_LIMIT_WINDOW_MS,
    scoping: "scoped",
    countFailedRequest: true,
    ...(context !== undefined && { context }),
    ...(generator !== undefined && { generator }),
  });
};
