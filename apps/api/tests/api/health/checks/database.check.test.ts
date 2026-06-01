import { describe, expect, test } from "bun:test";

import { databaseCheck } from "../../../../src/api/health/checks/database.check";
import { requireDb } from "../../../helpers/db";

describe("databaseCheck", () => {
  test("declares the canonical 'database' name", () => {
    expect(databaseCheck.name).toBe("database");
  });

  test("returns 'ok' with a non-negative latency when the DB is reachable", async () => {
    if (!(await requireDb())) {
      return;
    }

    const result = await databaseCheck.run();

    expect(result.name).toBe("database");
    expect(result.status).toBe("ok");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
