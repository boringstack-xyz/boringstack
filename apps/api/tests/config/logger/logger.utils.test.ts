import { describe, expect, test } from "bun:test";

import { logStartup } from "../../../src/config/logger/logger.utils";

describe("logStartup", () => {
  test("does not throw when called (log output goes to console)", () => {
    expect(() => {
      logStartup("localhost", 3000);
    }).not.toThrow();
  });

  test("accepts production hostnames", () => {
    expect(() => {
      logStartup("api.example.com", 8080);
    }).not.toThrow();
  });

  test("accepts ipv4 address", () => {
    expect(() => {
      logStartup("127.0.0.1", 3000);
    }).not.toThrow();
  });
});
