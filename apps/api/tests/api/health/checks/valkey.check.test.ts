import { describe, expect, test } from "bun:test";

import {
  closeValkeyHealthClient,
  valkeyCheck,
} from "../../../../src/api/health/checks/valkey.check";
import { requireValkey } from "../../../helpers/valkey";

describe("valkeyCheck", () => {
  test("declares the canonical 'valkey' name", () => {
    expect(valkeyCheck.name).toBe("valkey");
  });

  test("returns a structured result with a non-negative latency", async () => {
    if (!(await requireValkey())) {
      return;
    }

    const result = await valkeyCheck.run();

    expect(result.name).toBe("valkey");
    expect(["ok", "down", "degraded"]).toContain(result.status);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    await closeValkeyHealthClient();
  });
});
