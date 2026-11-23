import { afterEach, describe, expect, test } from "bun:test";

import { createAdminApp } from "../../src/config/app/admin-app";
import { setResolvedOperator } from "../../src/boot/operator";
import {
  ADMIN_REQUEST_HEADER,
  adminRequestRefusal,
} from "../../src/middleware/admin-request-guard";

const base = {
  method: "GET",
  path: "/api/v1/admin/queues",
  secFetchSite: null,
  adminHeader: "1",
  contentType: null,
  hasBody: false,
};

describe("adminRequestRefusal", () => {
  test("lets health and other non-admin reads through without the header", () => {
    expect(
      adminRequestRefusal({ ...base, path: "/health", adminHeader: null })
    ).toBeNull();
    expect(
      adminRequestRefusal({
        ...base,
        path: "/swagger/json",
        adminHeader: null,
        secFetchSite: "cross-site",
      })
    ).toBeNull();
  });

  test("refuses an admin read without the dashboard header", () => {
    expect(adminRequestRefusal({ ...base, adminHeader: null })).toBe(
      "missing_admin_header"
    );
    expect(adminRequestRefusal({ ...base, adminHeader: "0" })).toBe(
      "missing_admin_header"
    );
  });

  test("refuses an admin read from another site, even with the header", () => {
    expect(adminRequestRefusal({ ...base, secFetchSite: "cross-site" })).toBe(
      "cross_site"
    );
    expect(adminRequestRefusal({ ...base, secFetchSite: "same-site" })).toBe(
      "cross_site"
    );
  });

  test("allows a same-origin admin read that carries the header", () => {
    expect(
      adminRequestRefusal({ ...base, secFetchSite: "same-origin" })
    ).toBeNull();
    expect(adminRequestRefusal({ ...base, secFetchSite: "none" })).toBeNull();
  });

  test("refuses a write without the header, even when same-origin", () => {
    expect(
      adminRequestRefusal({
        ...base,
        method: "POST",
        secFetchSite: "same-origin",
        adminHeader: null,
        contentType: "application/json",
        hasBody: true,
      })
    ).toBe("missing_admin_header");
  });

  test("refuses a write whose body is not JSON, so a plain form never reaches a handler", () => {
    for (const contentType of [
      "application/x-www-form-urlencoded",
      "multipart/form-data; boundary=x",
      "text/plain",
    ]) {
      expect(
        adminRequestRefusal({
          ...base,
          method: "POST",
          contentType,
          hasBody: true,
        })
      ).toBe("not_json");
    }
  });

  test("allows a JSON write with the header and no cross-site signal", () => {
    expect(
      adminRequestRefusal({
        ...base,
        method: "POST",
        contentType: "application/json; charset=utf-8",
        hasBody: true,
      })
    ).toBeNull();
  });
});

describe("createAdminApp request guard", () => {
  afterEach(() => {
    setResolvedOperator(null);
  });

  test("refuses an admin read with no dashboard header", async () => {
    const app = createAdminApp();
    const res = await app.handle(
      new Request("http://127.0.0.1/api/v1/admin/queues")
    );

    expect(res.status).toBe(403);
  });

  test("refuses an admin read from a cross-site page even with the header", async () => {
    const app = createAdminApp();
    const res = await app.handle(
      new Request("http://127.0.0.1/api/v1/admin/audit", {
        headers: {
          [ADMIN_REQUEST_HEADER]: "1",
          "sec-fetch-site": "cross-site",
        },
      })
    );

    expect(res.status).toBe(403);
  });

  test("refuses a form-encoded write aimed at the admin API", async () => {
    const app = createAdminApp();
    const res = await app.handle(
      new Request("http://127.0.0.1/api/v1/admin/audit", {
        method: "POST",
        headers: {
          [ADMIN_REQUEST_HEADER]: "1",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "a=1",
      })
    );

    expect(res.status).toBe(403);
  });

  test("never allows by default: a same-origin, headered read is still refused when no operator was resolved", async () => {
    setResolvedOperator(null);

    const app = createAdminApp();
    const res = await app.handle(
      new Request("http://127.0.0.1/api/v1/admin/queues", {
        headers: {
          [ADMIN_REQUEST_HEADER]: "1",
          "sec-fetch-site": "same-origin",
        },
      })
    );

    expect(res.status).toBe(403);
  });

  test("answers /health without the header, so probes keep working", async () => {
    const app = createAdminApp();
    const res = await app.handle(new Request("http://127.0.0.1/health"));

    expect(res.status).toBe(200);
  });
});
