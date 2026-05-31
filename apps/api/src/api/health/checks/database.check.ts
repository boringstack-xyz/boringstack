import { sql } from "drizzle-orm";
import { db } from "../../../clients/postgres";
import { getErrorMessage } from "../../../lib/errors";
import type { IReadinessCheck, IReadinessResult } from "../health.types";
import { nowMs } from "../../../lib/time/now";

export const databaseCheck: IReadinessCheck = {
  name: "database",
  run: async (): Promise<IReadinessResult> => {
    const start = nowMs();

    try {
      await db.execute(sql`SELECT 1`);

      return {
        name: "database",
        status: "ok",
        latencyMs: nowMs() - start,
      };
    } catch (error: unknown) {
      return {
        name: "database",
        status: "down",
        latencyMs: nowMs() - start,
        message: getErrorMessage(error),
      };
    }
  },
};
