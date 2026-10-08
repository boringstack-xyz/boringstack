import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

// The build must fail, not publish, when configuration is invalid. These run the
// real Astro config loader; the build exits before rendering any page.
const siteRoot = fileURLToPath(new URL("../../", import.meta.url));
const astroBin = fileURLToPath(
  new URL("../../node_modules/astro/bin/astro.mjs", import.meta.url),
);

async function build(overrides: Record<string, string | undefined>) {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (
      value !== undefined &&
      !key.startsWith("SITE_") &&
      !key.startsWith("APP_") &&
      !key.startsWith("CONTACT_") &&
      !key.startsWith("ANALYTICS_")
    ) {
      env[key] = value;
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) env[key] = value;
  }
  const outDir = `${siteRoot}.build/test-dist-${crypto.randomUUID()}`;
  const proc = Bun.spawn(
    [process.execPath, astroBin, "build", "--outDir", outDir],
    {
      cwd: siteRoot,
      env,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stderr, stdout, code] = await Promise.all([
    new Response(proc.stderr).text(),
    new Response(proc.stdout).text(),
    proc.exited,
  ]);
  await Bun.$`rm -rf ${outDir}`.quiet().nothrow();
  return { code, output: stderr + stdout };
}

describe("astro build rejects invalid configuration", () => {
  test("a bad SITE_URL fails the build", async () => {
    const result = await build({
      SITE_URL: "http://boringstack.example.com",
      APP_URL: "https://app.boringstack.example.com",
      CONTACT_EMAIL: "hello@boringstack.example.com",
    });
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("SITE_URL must use https");
  }, 60_000);

  test("a missing CONTACT_EMAIL fails a public-origin build", async () => {
    const result = await build({
      SITE_URL: "https://boringstack.example.com",
      APP_URL: "https://app.boringstack.example.com",
      CONTACT_EMAIL: "",
    });
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("CONTACT_EMAIL is required");
  }, 60_000);

  test("an unset SITE_URL fails the build", async () => {
    const result = await build({
      SITE_URL: "",
      APP_URL: "https://app.boringstack.example.com",
    });
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("SITE_URL is required");
  }, 60_000);
});
