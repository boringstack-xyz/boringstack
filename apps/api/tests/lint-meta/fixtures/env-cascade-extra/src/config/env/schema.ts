import { t } from "elysia";

export const envSchema = t.Object({
  DATABASE_URL: t.String({ minLength: 1 }),
  JWT_SECRET: t.String({ minLength: 32 }),
});
