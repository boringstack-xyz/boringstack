import { notificationPreferencesService } from "../../lib/notifications";
import { errorHandler } from "../../middleware/error-handler";
import { createAuthMiddleware } from "../auth/auth.plugin";
import notificationsPushRoutes from "./notifications.push.routes";
import {
  ListNotificationsQuerySchema,
  MarkAllReadResponse,
  NotificationListResponse,
  PreferencesResponse,
  PublicNotificationSchema,
  UpdateNotificationBodySchema,
  UpdateNotificationParamsSchema,
  UpdatePreferencesBodySchema,
} from "./notifications.schemas";
import { notificationsService } from "./notifications.service";
import { notificationsStreamHandler } from "./notifications.sse";
import { parseNotificationsLimit } from "./notifications.utils";

const notificationsRoutes = createAuthMiddleware()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .group("/push", (app) => app.use(notificationsPushRoutes))
  .get(
    "/",
    async ({ user, query }) =>
      notificationsService.list({
        userId: user.id,
        status: query.status,
        limit: parseNotificationsLimit(query.limit),
        cursor: query.cursor,
      }),
    {
      query: ListNotificationsQuerySchema,
      response: NotificationListResponse,
      detail: {
        tags: ["Notifications"],
        summary: "List the current user's notifications",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/preferences",
    async ({ user }) => ({
      items: await notificationPreferencesService.listForUser(user.id),
    }),
    {
      response: PreferencesResponse,
      detail: {
        tags: ["Notifications"],
        summary: "List the current user's notification preferences",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .put(
    "/preferences",
    async ({ user, body }) => ({
      items: await notificationPreferencesService.update({
        userId: user.id,
        preferences: body.preferences,
      }),
    }),
    {
      body: UpdatePreferencesBodySchema,
      response: PreferencesResponse,
      detail: {
        tags: ["Notifications"],
        summary: "Bulk-update notification preferences",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .patch(
    "/:id",
    async ({ user, params, body }) =>
      notificationsService.updateStatus({
        userId: user.id,
        notificationId: params.id,
        status: body.status,
      }),
    {
      params: UpdateNotificationParamsSchema,
      body: UpdateNotificationBodySchema,
      response: PublicNotificationSchema,
      detail: {
        tags: ["Notifications"],
        summary: "Mark a notification as read or archived",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .post(
    "/mark-all-read",
    async ({ user }) => notificationsService.markAllRead({ userId: user.id }),
    {
      response: MarkAllReadResponse,
      detail: {
        tags: ["Notifications"],
        summary: "Mark every unread notification as read",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get("/stream", notificationsStreamHandler, {
    detail: {
      tags: ["Notifications"],
      summary: "Server-Sent Events stream of new notifications",
      security: [{ cookieAuth: [] }],
    },
  });

export default notificationsRoutes;
