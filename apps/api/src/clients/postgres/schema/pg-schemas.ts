import { pgSchema } from "drizzle-orm/pg-core";

/**
 * Postgres namespace declarations. One per logical domain so authz
 * filtering, ownership, and migrations stay scoped — and `drizzle.config.ts`
 * can target them via `schemaFilter`.
 */
export const auth = pgSchema("auth");
export const billing = pgSchema("billing");
export const audit = pgSchema("audit");
export const app = pgSchema("app");
export const notifications = pgSchema("notifications");
