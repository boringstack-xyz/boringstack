import { subject } from "@casl/ability";
import { t } from "elysia";

import {
  buildAbility,
  enforceLimit,
  requireAbility,
  resolveAccountFeatures,
} from "../../lib/acl";
import { errorHandler } from "../../middleware/error-handler";
import { resolveActiveMembership } from "../../middleware/require-active-membership";
import { createAuthMiddleware } from "../auth/auth.plugin";

import {
  CreateWidgetSchema,
  UpdateWidgetSchema,
  WidgetListResponse,
  WidgetResponse,
} from "./widgets.schemas";
import { widgetsService } from "./widgets.service";

const widgetsRoutes = createAuthMiddleware()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .derive(async ({ user, accountId }) => {
    const membership = await resolveActiveMembership(user.id, accountId);
    const features = await resolveAccountFeatures(membership.accountId);
    const ability = buildAbility(
      {
        userId: user.id,
        role: membership.role,
        accountId: membership.accountId,
      },
      features
    );

    const widgetSubject = () =>
      subject("Widget", { accountId: membership.accountId });

    return { membership, features, ability, widgetSubject };
  })
  .get(
    "/",
    async ({ membership }) => ({
      items: await widgetsService.list(membership.accountId),
    }),
    {
      response: WidgetListResponse,
      detail: {
        tags: ["Widgets"],
        summary: "List widgets in the active account",
      },
    }
  )
  .get(
    "/:id",
    async ({ membership, params }) =>
      widgetsService.getById(membership.accountId, params.id),
    {
      params: t.Object({ id: t.String() }),
      response: WidgetResponse,
      detail: {
        tags: ["Widgets"],
        summary: "Get a widget by id (account-scoped)",
      },
    }
  )
  .post(
    "/",
    async ({ membership, body, user, features, ability, widgetSubject }) => {
      requireAbility(ability, "create", widgetSubject());

      const existing = await widgetsService.list(membership.accountId);

      enforceLimit("max_widgets", existing.length, features.max_widgets);

      return widgetsService.create(membership.accountId, user.id, body);
    },
    {
      body: CreateWidgetSchema,
      response: WidgetResponse,
      detail: {
        tags: ["Widgets"],
        summary: "Create a widget in the active account",
      },
    }
  )
  .patch(
    "/:id",
    async ({ membership, params, body, user, ability, widgetSubject }) => {
      requireAbility(ability, "update", widgetSubject());

      return widgetsService.update(
        membership.accountId,
        user.id,
        params.id,
        body
      );
    },
    {
      params: t.Object({ id: t.String() }),
      body: UpdateWidgetSchema,
      response: WidgetResponse,
      detail: {
        tags: ["Widgets"],
        summary: "Update a widget (account-scoped)",
      },
    }
  )
  .delete(
    "/:id",
    async ({ membership, params, user, set, ability, widgetSubject }) => {
      requireAbility(ability, "delete", widgetSubject());

      await widgetsService.delete(membership.accountId, user.id, params.id);
      set.status = 204;

      return null;
    },
    {
      params: t.Object({ id: t.String() }),
      response: t.Null(),
      detail: {
        tags: ["Widgets"],
        summary: "Delete a widget (account-scoped)",
      },
    }
  );

export default widgetsRoutes;
