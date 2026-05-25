import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { ApiErrors, getErrorMessage } from "../../lib/errors";
import { userNotificationChannel, valkeyPubSub } from "../../lib/notifications";

const SSE_KEEPALIVE_MS = 25_000;
const SSE_BUFFER_MAX = 100;

interface ISseContext {
  user: { id: string };
  set: { headers: Record<string, string | number> };
  request: Request;
}

/**
 * SSE stream endpoint for realtime notification delivery. Subscribes to a
 * per-user Valkey channel and forwards every published message as an SSE
 * `data:` event. Sends a comment-only `:ping` every 25 s so proxies don't
 * idle-close the connection.
 *
 * Cleanup is anchored to the request's `AbortSignal` — when the browser
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
   * narrow `signal.aborted` to its initial `false` value — it actually
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

  try {
    while (!isAborted()) {
      while (buffer.length > 0 && !isAborted()) {
        const next = buffer.shift();

        if (next !== undefined) {
          yield next;
        }
      }

      if (isAborted()) {
        break;
      }

      const keepalive = new Promise<void>((resolve) => {
        setTimeout(resolve, SSE_KEEPALIVE_MS);
      });
      const messageWait = new Promise<void>((resolve) => {
        resolveWaiter = resolve;
      });

      await Promise.race([keepalive, messageWait]);
      resolveWaiter = null;

      if (!isAborted() && buffer.length === 0) {
        /*
         * Keepalive. SSE allows comment-only frames (`:foo\n\n`), but
         * Elysia's generator-to-SSE adapter wraps every yielded value
         * as `data:`, so a bare `:ping` would reach the browser as a
         * real `message` event with payload `:ping` — not a comment.
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
