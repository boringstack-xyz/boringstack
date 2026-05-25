import { errorHandler } from "../../middleware/error-handler";
import { createAuthMiddleware } from "../auth/auth.plugin";
import {
  PushSubscriptionsListResponse,
  SubscribePushBodySchema,
  SubscribePushResponse,
  UnsubscribePushBodySchema,
  UnsubscribePushResponse,
} from "./notifications.push.schemas";
import { notificationsPushService } from "./notifications.push.service";
import { expirationToIso } from "./notifications.push.utils";

/**
 * Mounted under `/api/v1/notifications/push` (see notifications.routes.ts).
 * All three endpoints require the standard auth cookie — the public VAPID
 * key is exposed to the UI via the `VITE_VAPID_PUBLIC_KEY` build-time env,
 * not a runtime endpoint here.
 */
export const notificationsPushRoutes = createAuthMiddleware()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .post(
    "/subscribe",
    async ({ user, body }) => {
      const subscription = await notificationsPushService.subscribe({
        userId: user.id,
        endpoint: body.endpoint,
        p256dhKey: body.keys.p256dh,
        authKey: body.keys.auth,
        expiresAt: expirationToIso(body.expirationTime ?? null),
        userAgent: body.userAgent ?? null,
      });

      return { subscription };
    },
    {
      body: SubscribePushBodySchema,
      response: SubscribePushResponse,
      detail: {
        tags: ["Notifications"],
        summary: "Register a Web Push subscription for the current user",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .delete(
    "/subscribe",
    async ({ user, body }) =>
      notificationsPushService.unsubscribe({
        userId: user.id,
        endpoint: body.endpoint,
      }),
    {
      body: UnsubscribePushBodySchema,
      response: UnsubscribePushResponse,
      detail: {
        tags: ["Notifications"],
        summary: "Remove a Web Push subscription for the current user",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/subscriptions",
    async ({ user }) => ({
      items: await notificationsPushService.listForUser(user.id),
    }),
    {
      response: PushSubscriptionsListResponse,
      detail: {
        tags: ["Notifications"],
        summary: "List the current user's Web Push subscriptions",
        security: [{ cookieAuth: [] }],
      },
    }
  );

export default notificationsPushRoutes;
