import { describe, expect, it } from "bun:test";
import {
  buildDrizzleCredentials,
  buildPostgresSsl,
} from "../../../src/lib/postgres/connection";

describe("buildPostgresSsl", () => {
  it("disables TLS outside production", () => {
    expect(
      buildPostgresSsl({
        isProduction: false,
        rejectUnauthorized: true,
        ca: "pem",
      })
    ).toBe(false);
  });

  it("verifies against system CAs in production when no CA is configured", () => {
    expect(
      buildPostgresSsl({ isProduction: true, rejectUnauthorized: true, ca: "" })
    ).toEqual({ rejectUnauthorized: true });
  });

  it("carries the configured CA bundle in production", () => {
    expect(
      buildPostgresSsl({
        isProduction: true,
        rejectUnauthorized: true,
        ca: "-----BEGIN CERTIFICATE-----",
      })
    ).toEqual({
      rejectUnauthorized: true,
      ca: "-----BEGIN CERTIFICATE-----",
    });
  });
});

describe("buildDrizzleCredentials", () => {
  it("passes the URL through unchanged when TLS is off", () => {
    expect(
      buildDrizzleCredentials("postgresql://app:pw@localhost:5432/app", false)
    ).toEqual({ url: "postgresql://app:pw@localhost:5432/app" });
  });

  it("splits the URL and carries the runtime ssl object when TLS is on", () => {
    const ssl = { rejectUnauthorized: true, ca: "pem" };

    expect(
      buildDrizzleCredentials(
        "postgresql://app%40ops:p%40ss%2Fword@db.internal:6432/tinkercaster",
        ssl
      )
    ).toEqual({
      host: "db.internal",
      port: 6432,
      user: "app@ops",
      password: "p@ss/word",
      database: "tinkercaster",
      ssl,
    });
  });

  it("defaults the port to 5432 when the URL omits it", () => {
    expect(
      buildDrizzleCredentials("postgresql://app:pw@db.internal/app", {
        rejectUnauthorized: true,
      })
    ).toMatchObject({ host: "db.internal", port: 5432 });
  });
});
