import { describe, expect, test } from "bun:test";

import {
  closeValkeyHealthClient,
  getHealthClient,
} from "../../../../src/api/health/checks/valkey.check.client";
import { requireValkey } from "../../../helpers/valkey";

describe("valkey health client lifecycle", () => {
  test("getHealthClient returns the same lazy singleton across calls", async () => {
    if (!(await requireValkey())) {
      return;
    }

    const first = getHealthClient();
    const second = getHealthClient();

    expect(first).toBe(second);

    await closeValkeyHealthClient();
  });

  test("closeValkeyHealthClient is a no-op when no client is open", async () => {
    await closeValkeyHealthClient();

    let threw = false;

    try {
      await closeValkeyHealthClient();
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
  });

  test("getHealthClient returns a fresh instance after close", async () => {
    if (!(await requireValkey())) {
      return;
    }

    const first = getHealthClient();

    await closeValkeyHealthClient();

    const second = getHealthClient();

    expect(first).not.toBe(second);

    await closeValkeyHealthClient();
  });
});
