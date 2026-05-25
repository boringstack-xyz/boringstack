import { t } from "elysia";

export const WidgetResponse = t.Object({
  id: t.String(),
  accountId: t.String(),
  name: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const WidgetListResponse = t.Object({
  items: t.Array(WidgetResponse),
});

export const CreateWidgetSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 200 }),
});

export const UpdateWidgetSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 200 }),
});
