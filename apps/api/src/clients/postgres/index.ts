import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { buildPostgresSsl } from "../../lib/postgres/connection";
import * as schema from "./schema";

const client = postgres(env.DATABASE_URL, {
  max: env.DATABASE_POOL_SIZE,
  idle_timeout: 20,
  connect_timeout: env.isTest ? 1 : 10,
  max_lifetime: 60 * 30,
  prepare: true,
  ssl: buildPostgresSsl({
    isProduction: env.isProduction,
    rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED,
    ca: env.DATABASE_SSL_CA,
  }),
  onnotice: (notice) => {
    if (!env.isDevelopment) {
      return;
    }

    logger.debug("Database notice", {
      event: "db.notice",
      notice: notice.message,
    });
  },
});

export const db = drizzle(client, {
  schema,
  logger: env.isDevelopment,
});

logger.info("Database connected", {
  event: "db.connected",
  poolSize: env.DATABASE_POOL_SIZE,
  ssl: env.isProduction,
});

export { client as postgresClient };
