import * as dotenv from "dotenv";
import type { Config } from "drizzle-kit";

import {
  buildDrizzleCredentials,
  buildPostgresSsl,
} from "./src/lib/postgres/connection";
import { toBoolWithDefault } from "./src/config/env/validate";

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env" });

// Same TLS policy as the runtime client, so migrations verify the database
// certificate with the same CA the API uses (see src/lib/postgres/connection.ts).
const ssl = buildPostgresSsl({
  isProduction: process.env.NODE_ENV === "production",
  rejectUnauthorized: toBoolWithDefault(
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
    true,
    "DATABASE_SSL_REJECT_UNAUTHORIZED"
  ),
  ca: process.env.DATABASE_SSL_CA ?? "",
});

export default {
  schema: "./src/clients/postgres/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: buildDrizzleCredentials(
    process.env.DATABASE_URL ??
      "postgresql://app:app_dev_password@localhost:5432/app",
    ssl
  ),
  schemaFilter: ["auth", "billing", "audit", "app", "notifications"],
  verbose: true,
  strict: true,
} satisfies Config;
