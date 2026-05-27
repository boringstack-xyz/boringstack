import { t } from "elysia";

export const envSchema = t.Object({
  DATABASE_URL: t.String({ minLength: 1 }),
  JWT_SECRET: t.String({ minLength: 32 }),
  PORT: t.Integer({ minimum: 1, maximum: 65535, default: 7330 }),
});
