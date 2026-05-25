import { describe, expect, test } from "bun:test";

import { redactSensitiveInfo } from "../../src/middleware/request-logger.utils";

describe("redactSensitiveInfo", () => {
  test("returns the empty string unchanged", () => {
    expect(redactSensitiveInfo("")).toBe("");
  });

  test("returns the input unchanged when there is no sensitive parameter", () => {
    const url = "http://localhost/api/v1/health?service=postgres";

    expect(redactSensitiveInfo(url)).toBe(url);
  });

  test("redacts every sensitive query-param part", () => {
    const url =
      "http://localhost/api/v1/auth/oauth/callback?code=alpha&state=beta&token=gamma&password=delta&secret=epsilon&key=zeta&auth=eta";
    const redacted = redactSensitiveInfo(url);

    expect(redacted).toContain("code=%5BREDACTED%5D");
    expect(redacted).toContain("state=%5BREDACTED%5D");
    expect(redacted).toContain("token=%5BREDACTED%5D");
    expect(redacted).toContain("password=%5BREDACTED%5D");
    expect(redacted).toContain("secret=%5BREDACTED%5D");
    expect(redacted).toContain("key=%5BREDACTED%5D");
    expect(redacted).toContain("auth=%5BREDACTED%5D");
    expect(redacted).not.toContain("alpha");
    expect(redacted).not.toContain("beta");
    expect(redacted).not.toContain("gamma");
  });

  test("returns malformed URLs as-is rather than throwing", () => {
    expect(redactSensitiveInfo("not a url")).toBe("not a url");
  });
});
