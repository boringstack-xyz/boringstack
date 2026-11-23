import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { setResolvedOperator } from "../../../src/boot/operator";
import { createAdminApp } from "../../../src/config/app/admin-app";
import { ADMIN_REQUEST_HEADER } from "../../../src/middleware/admin-request-guard";
import { seedVerifiedUser } from "../../helpers/auth";
import { cleanDatabase, requireDb } from "../../helpers/db";

const ADMIN_HEADERS = { [ADMIN_REQUEST_HEADER]: "1" };

describe("admin routes: operator", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  afterEach(() => {
    setResolvedOperator(null);
  });

  test("refuses every admin route when no operator is resolved", async () => {
    setResolvedOperator(null);

    const app = createAdminApp();
    const res = await app.handle(
      new Request("http://127.0.0.1/api/v1/admin/audit", {
        headers: ADMIN_HEADERS,
      })
    );

    expect(res.status).toBe(403);
  });

  test("serves the audit feed to the resolved operator, without emails", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user } = await seedVerifiedUser({
      email: "operator@example.com",
      password: "Hunter2Strong!",
      firstName: "Op",
      lastName: "Test",
      isPlatformAdmin: true,
    });

    setResolvedOperator({ id: user.id });

    const app = createAdminApp();
    const res = await app.handle(
      new Request("http://127.0.0.1/api/v1/admin/audit?limit=5", {
        headers: ADMIN_HEADERS,
      })
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    expect(typeof body === "object" && body !== null && "entries" in body).toBe(
      true
    );
    expect(JSON.stringify(body)).not.toContain("operator@example.com");
  });
});
