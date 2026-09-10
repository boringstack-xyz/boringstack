import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { ApiErrors, getErrorMessage } from "../../lib/errors";
import { jwtRevocationService } from "../../lib/jwt";
import type { IAuthCredential } from "../auth/auth.types";
import { nowMs } from "../../lib/time/now";
import { userNotificationChannel, valkeyPubSub } from "../../lib/notifications";

const SSE_KEEPALIVE_MS = 25_000;
const SSE_BUFFER_MAX = 100;

/*
 * How often an open stream re-checks that its session is still valid.
 *
 * Authentication happens once, when the connection opens. Looping on the
 * client's abort signal alone would let a stream opened before logout go on
 * delivering that user's notifications for as long as the socket stays up,
 * and the 15-minute access-token lifetime bounds nothing here because the
 * token is not read again.
 *
 * Shorter than the keepalive on purpose: revocation has to take effect in
 * seconds, not on the next ping. The check is a single cache read.
 */
const SSE_AUTH_RECHECK_MS = 1_000;

interface ISseContext {
  user: { id: string };
  /**
   * The token this connection was opened with. A stream outlives the
   * request that authenticated it, so it has to keep re-checking the
   * credential rather than trusting the one admission decision.
   */
  credential: IAuthCredential;
  set: { headers: Record<string, string | number> };
  request: Request;
}

/**
 * SSE stream endpoint for realtime notification delivery. Subscribes to a
 * per-user Valkey channel and forwards every published message as an SSE
 * `data:` event. Sends a comment-only `:ping` every 25 s so proxies don't
 * idle-close the connection.
 *
 * Cleanup is anchored to the request's `AbortSignal`: when the browser
 * tab closes or the connection drops, the signal fires, the wait loop
 * resolves, the generator's `finally` block runs, and the Valkey
 * subscriber disconnects. Without that signal hook a closed browser would
 * leak ioredis connections.
 */
export const notificationsStreamHandler = async function* (
  ctx: ISseContext
): AsyncGenerator<string, void, void> {
  if (!env.NOTIFICATIONS_SSE_ENABLED) {
    throw ApiErrors.notFound("Realtime notifications");
  }

  ctx.set.headers["content-type"] = "text/event-stream";
  ctx.set.headers["cache-control"] = "no-cache";
  ctx.set.headers.connection = "keep-alive";
  ctx.set.headers["x-accel-buffering"] = "no";

  const channelName = userNotificationChannel(ctx.user.id);
  const buffer: string[] = [];
  let resolveWaiter: (() => void) | null = null;

  /*
   * Indirected through a function so TypeScript's flow analysis doesn't
   * narrow `signal.aborted` to its initial `false` value: it actually
   * flips when the request is aborted from outside.
   */
  const signal = ctx.request.signal;
  const isAborted = (): boolean => signal.aborted;

  const wakeWaiter = (): void => {
    if (resolveWaiter === null) {
      return;
    }

    const fn = resolveWaiter;

    resolveWaiter = null;
    fn();
  };

  const onAbort = (): void => {
    wakeWaiter();
  };

  ctx.request.signal.addEventListener("abort", onAbort);

  const subscriber = await valkeyPubSub.subscribe(channelName, (message) => {
    if (buffer.length >= SSE_BUFFER_MAX) {
      logger.warn("SSE buffer overflow — dropping oldest message", {
        event: "notifications.sse.buffer_overflow",
        userId: ctx.user.id,
        dropped: 1,
      });
      buffer.shift();
    }

    buffer.push(message);
    wakeWaiter();
  });

  logger.info("SSE notification stream opened", {
    event: "notifications.sse.opened",
    userId: ctx.user.id,
  });

  /**
   * Whether the credential that opened this stream is still good.
   *
   * Three separate ways it stops being good, and a stream has to honour
   * all of them:
   *
   *   - it expired. The token carries its own `exp`; nothing else bounds
   *     how long this connection may live.
   *   - it was revoked individually. Ordinary `/auth/logout` calls
   *     `revokeJti`, NOT `revokeAllForUser`, so a user-wide check alone
   *     never sees the revocation that logging out actually writes.
   *   - every token for the user was revoked (password reset,
   *     "sign out everywhere"), compared against the token's own `iat`.
   *     The stream's open time is not a substitute: a token issued before
   *     the cutoff and used to open a stream after it would pass.
   */
  const credentialValid = async (): Promise<boolean> => {
    const { jti, issuedAt, expiresAt } = ctx.credential;

    if (expiresAt !== null && expiresAt * 1000 <= nowMs()) {
      return false;
    }

    if (jti !== null && (await jwtRevocationService.isJtiRevoked(jti))) {
      return false;
    }

    if (
      issuedAt !== null &&
      (await jwtRevocationService.isUserRevokedSince(ctx.user.id, issuedAt))
    ) {
      return false;
    }

    return true;
  };

  const sessionRevoked = async (): Promise<boolean> =>
    !(await credentialValid());

  const logRevoked = (): void => {
    logger.info("SSE notification stream closed by revocation", {
      event: "notifications.sse.revoked",
      userId: ctx.user.id,
    });
  };

  let lastPingAtMs = nowMs();

  try {
    while (!isAborted()) {
      /*
       * The credential is re-checked before every payload, not once per
       * pass. Each `yield` suspends the generator for as long as the
       * consumer wants, and a revocation landing in that window has to
       * stop the next message: a check that only runs when the buffer
       * empties is one a publisher can postpone indefinitely by keeping
       * the buffer full.
       */
      while (buffer.length > 0 && !isAborted()) {
        if (await sessionRevoked()) {
          logRevoked();

          return;
        }

        const next = buffer.shift();

        if (next !== undefined) {
          yield next;
        }
      }

      if (isAborted() || (await sessionRevoked())) {
        break;
      }

      const tick = new Promise<void>((resolve) => {
        setTimeout(resolve, SSE_AUTH_RECHECK_MS);
      });
      const messageWait = new Promise<void>((resolve) => {
        resolveWaiter = resolve;
      });

      await Promise.race([tick, messageWait]);
      resolveWaiter = null;

      if (await sessionRevoked()) {
        logRevoked();

        break;
      }

      if (
        !isAborted() &&
        buffer.length === 0 &&
        nowMs() - lastPingAtMs >= SSE_KEEPALIVE_MS
      ) {
        lastPingAtMs = nowMs();

        /*
         * Keepalive. SSE allows comment-only frames (`:foo\n\n`), but
         * Elysia's generator-to-SSE adapter wraps every yielded value
         * as `data:`, so a bare `:ping` would reach the browser as a
         * real `message` event with payload `:ping`, not a comment.
         * We emit a JSON envelope instead: servers and proxies count
         * it as activity (same as a comment would), and the client's
         * `parseStreamMessage` ignores any type other than
         * `notification.created`, so this is a no-op in the UI.
         */
        yield JSON.stringify({ type: "ping" });
      }
    }
  } catch (error: unknown) {
    logger.error("SSE notification stream errored", {
      event: "notifications.sse.errored",
      userId: ctx.user.id,
      error: getErrorMessage(error),
    });

    throw error;
  } finally {
    ctx.request.signal.removeEventListener("abort", onAbort);
    await subscriber.disconnect();
    logger.info("SSE notification stream closed", {
      event: "notifications.sse.closed",
      userId: ctx.user.id,
    });
  }
};
