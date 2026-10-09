import { describe, expect, test } from "bun:test";
import {
  buildCsp,
  resolveSiteConfig,
  SiteConfigError,
} from "../../src/lib/config-core.mjs";
import { canonicalPath, jsonLd } from "../../src/lib/seo";

const valid = {
  SITE_URL: "https://boringstack.example.com",
  APP_URL: "https://app.boringstack.example.com",
  CONTACT_EMAIL: "hello@boringstack.example.com",
};

function rejects(env: Record<string, string>, pattern: RegExp) {
  expect(() => resolveSiteConfig(env)).toThrow(SiteConfigError);
  expect(() => resolveSiteConfig(env)).toThrow(pattern);
}

describe("resolveSiteConfig", () => {
  test("accepts a public origin and normalises it to an origin", () => {
    const config = resolveSiteConfig({
      ...valid,
      SITE_URL: "https://Boringstack.example.com/",
    });
    expect(config.siteUrl).toBe("https://boringstack.example.com");
    expect(config.appUrl).toBe("https://app.boringstack.example.com");
    expect(config.indexable).toBe(true);
    expect(config.analytics).toBeNull();
  });

  test("is frozen so pages cannot mutate build configuration", () => {
    expect(Object.isFrozen(resolveSiteConfig(valid))).toBe(true);
  });

  test("rejects a missing SITE_URL", () => {
    rejects({ ...valid, SITE_URL: "" }, /SITE_URL is required/);
  });

  test("rejects a SITE_URL that is not an absolute URL", () => {
    rejects(
      { ...valid, SITE_URL: "boringstack.example.com" },
      /SITE_URL must be an absolute URL/,
    );
  });

  test("rejects a non-http scheme", () => {
    rejects(
      { ...valid, SITE_URL: "ftp://boringstack.example.com" },
      /must use http or https/,
    );
  });

  test("rejects a SITE_URL with a path", () => {
    rejects(
      { ...valid, SITE_URL: "https://boringstack.example.com/blog" },
      /without a path/,
    );
  });

  test("rejects a SITE_URL with a query or fragment", () => {
    rejects(
      { ...valid, SITE_URL: "https://boringstack.example.com/?a=1" },
      /without a path/,
    );
    rejects(
      { ...valid, SITE_URL: "https://boringstack.example.com/#top" },
      /without a path/,
    );
  });

  test("rejects credentials in SITE_URL", () => {
    rejects(
      { ...valid, SITE_URL: "https://user:pw@boringstack.example.com" },
      /credentials/,
    );
  });

  test("rejects plain http outside localhost", () => {
    rejects(
      { ...valid, SITE_URL: "http://boringstack.example.com" },
      /must use https outside localhost/,
    );
  });

  test("allows http on localhost for development, without indexing", () => {
    const config = resolveSiteConfig({
      SITE_URL: "http://localhost:7333",
      APP_URL: "http://localhost:7331",
    });
    expect(config.indexable).toBe(false);
    expect(config.contactEmail).toBe("");
  });

  test("requires CONTACT_EMAIL for a public-origin build", () => {
    rejects({ ...valid, CONTACT_EMAIL: "" }, /CONTACT_EMAIL is required/);
    rejects({ ...valid, CONTACT_EMAIL: "   " }, /CONTACT_EMAIL is required/);
  });

  test("rejects a malformed CONTACT_EMAIL", () => {
    rejects(
      { ...valid, CONTACT_EMAIL: "not-an-address" },
      /CONTACT_EMAIL must be an email address/,
    );
  });

  test("requires APP_URL to be a different origin from SITE_URL", () => {
    rejects(
      { ...valid, APP_URL: "https://boringstack.example.com" },
      /different origin/,
    );
  });

  test("rejects plain http APP_URL outside localhost", () => {
    rejects(
      { ...valid, APP_URL: "http://app.boringstack.example.com" },
      /APP_URL must use https/,
    );
  });

  test("analytics is off unless both values are set", () => {
    expect(resolveSiteConfig(valid).analytics).toBeNull();
    rejects(
      {
        ...valid,
        ANALYTICS_SCRIPT_URL: "https://analytics.example.com/script.js",
      },
      /set together/,
    );
    rejects({ ...valid, ANALYTICS_WEBSITE_ID: "abc123" }, /set together/);
  });

  test("accepts a configured analytics script on https", () => {
    const config = resolveSiteConfig({
      ...valid,
      ANALYTICS_SCRIPT_URL: "https://analytics.example.com/script.js",
      ANALYTICS_WEBSITE_ID: "abc-123_X",
    });
    expect(config.analytics).toEqual({
      scriptUrl: "https://analytics.example.com/script.js",
      origin: "https://analytics.example.com",
      websiteId: "abc-123_X",
    });
  });

  test("rejects an analytics script that is not https", () => {
    rejects(
      {
        ...valid,
        ANALYTICS_SCRIPT_URL: "http://analytics.example.com/s.js",
        ANALYTICS_WEBSITE_ID: "abc",
      },
      /must use https/,
    );
  });

  test("rejects an analytics website id with unsafe characters", () => {
    rejects(
      {
        ...valid,
        ANALYTICS_SCRIPT_URL: "https://analytics.example.com/s.js",
        ANALYTICS_WEBSITE_ID: 'x"><script>',
      },
      /ANALYTICS_WEBSITE_ID must be/,
    );
  });
});

describe("buildCsp", () => {
  test("allows only 'self' when analytics is off", () => {
    const csp = buildCsp(resolveSiteConfig(valid));
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("style-src 'self';");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("https://");
    expect(csp).not.toContain("unsafe-inline");
  });

  test("allows exactly the analytics origin for script and connect when configured", () => {
    const csp = buildCsp(
      resolveSiteConfig({
        ...valid,
        ANALYTICS_SCRIPT_URL: "https://analytics.example.com/s.js",
        ANALYTICS_WEBSITE_ID: "abc",
      }),
    );
    expect(csp).toContain("script-src 'self' https://analytics.example.com;");
    expect(csp).toContain("connect-src 'self' https://analytics.example.com;");
    expect(csp).not.toContain("https://analytics.example.com/s.js");
  });
});

describe("canonical paths and structured data", () => {
  test("canonicalPath is slashless and maps index pages to their directory", () => {
    expect(canonicalPath("/")).toBe("/");
    expect(canonicalPath("/index.html")).toBe("/");
    expect(canonicalPath("/about/")).toBe("/about");
    expect(canonicalPath("/about.html")).toBe("/about");
    expect(canonicalPath("/blog/hello-world")).toBe("/blog/hello-world");
  });

  test("jsonLd escapes < so a value cannot close the script element", () => {
    const out = jsonLd({ name: "</script><script>alert(1)" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)" });
  });
});
