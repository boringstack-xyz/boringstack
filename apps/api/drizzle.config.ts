import * as dotenv from "dotenv";
import type { Config } from "drizzle-kit";

dotenv.config({ path: ".env" });

export default {
  schema: "./src/clients/postgres/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://app:app_dev_password@localhost:5432/app",
  },
  schemaFilter: ["auth", "billing", "audit", "app", "notifications"],
  verbose: true,
  strict: true,
} satisfies Config;
