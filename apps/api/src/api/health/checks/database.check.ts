import { sql } from "drizzle-orm";
import { db } from "../../../clients/postgres";
import { getErrorMessage } from "../../../lib/errors";
import type { IReadinessCheck, IReadinessResult } from "../health.types";

export const databaseCheck: IReadinessCheck = {
  name: "database",
  run: async (): Promise<IReadinessResult> => {
    const start = Date.now();

    try {
      await db.execute(sql`SELECT 1`);

      return {
        name: "database",
        status: "ok",
        latencyMs: Date.now() - start,
      };
    } catch (error: unknown) {
      return {
        name: "database",
        status: "down",
        latencyMs: Date.now() - start,
        message: getErrorMessage(error),
      };
    }
  },
};
