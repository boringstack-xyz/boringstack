import { t } from "elysia";

export const UnsubscribeQuery = t.Object({
  token: t.String({ minLength: 1, maxLength: 200 }),
});
