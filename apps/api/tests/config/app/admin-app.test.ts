import { afterEach, describe, expect, test } from "bun:test";

import { setResolvedOperator } from "../../../src/boot/operator";
import { createAdminApp } from "../../../src/config/app/admin-app";
import { createApp } from "../../../src/config/app";
import { swaggerConfig } from "../../../src/config/swagger";
import { ADMIN_REQUEST_HEADER } from "../../../src/middleware/admin-request-guard";

const ADMIN_HEADERS = { [ADMIN_REQUEST_HEADER]: "1" };

const documentedPaths = async (app: {
  handle: (request: Request) => Response | Promise<Response>;
}): Promise<string[]> => {
  const res = await app.handle(new Request("http://127.0.0.1/swagger/json"));

  const doc: unknown = await res.json();

  if (typeof doc !== "object" || doc === null || !("paths" in doc)) {
    return [];
  }

  const { paths } = doc;

  return typeof paths === "object" && paths !== null ? Object.keys(paths) : [];
};

describe("public API process", () => {
  test("does not mount any /api/v1/admin route", async () => {
    const app = createApp();

    const res = await app.handle(
      new Request("http://127.0.0.1/api/v1/admin/queues", {
        headers: ADMIN_HEADERS,
      })
    );

    expect(res.status).toBe(404);
  });

  test("its OpenAPI document lists nothing under /api/v1/admin", async () => {
    const paths = await documentedPaths(createApp().use(swaggerConfig));

    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((path) => path.startsWith("/api/v1/admin"))).toEqual(
      []
    );
  });
});

describe("LAN-only admin API process", () => {
  afterEach(() => {
    setResolvedOperator(null);
  });

  test("mounts the admin routes under /api/v1/admin", async () => {
    setResolvedOperator(null);

    const app = createAdminApp();
    const res = await app.handle(
      new Request("http://127.0.0.1/api/v1/admin/queues", {
        headers: ADMIN_HEADERS,
      })
    );

    // Mounted but refused: no operator resolved. A 404 would mean the route is absent.
    expect(res.status).toBe(403);
  });

  test("its OpenAPI document documents the admin operations", async () => {
    const paths = await documentedPaths(createAdminApp().use(swaggerConfig));

    expect(paths).toContain("/api/v1/admin/queues");
    expect(paths).toContain("/api/v1/admin/audit");
  });
});
