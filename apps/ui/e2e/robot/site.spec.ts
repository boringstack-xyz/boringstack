import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/robot";
import { robotConfig } from "./robot.config";

/*
 * The public site (apps/site): every address in the sitemap answers with a
 * page, and the home page leads into the app.
 */
const SITE = robotConfig.siteURL ?? "";
const SWEEP_AT_ONCE = 8;
/* Sitemap indexes nest at most this deep (Astro writes an index plus its parts). */
const SITEMAP_DEPTH = 3;

/** Script errors and anything of the site's own that failed to load. */
function watchSite(page: Page): string[] {
  const problems: string[] = [];
  const origin = new URL(SITE).origin;

  page.on("pageerror", (error) => {
    problems.push(`script error on ${page.url()}: ${error.message}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().startsWith(origin)) {
      problems.push(`${String(response.status())} from ${response.url()}`);
    }
  });

  return problems;
}

/** The sitemap names the public host; a staging site is read on its own. */
const onSite = (address: string): string =>
  address.replace(/^https?:\/\/[^/]+/u, new URL(SITE).origin);

async function readSitemap(
  page: Page,
  address: string,
  depth: number
): Promise<string[]> {
  const res = await page.request.get(onSite(address));

  expect(res.status(), `${address} answers`).toBe(200);

  const locs = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
    (match) => match[1] ?? ""
  );
  const nested = locs.filter((loc) => loc.endsWith(".xml"));
  const pages = locs.filter((loc) => !loc.endsWith(".xml"));

  if (depth === 0 || nested.length === 0) {
    return pages;
  }

  const children = await Promise.all(
    nested.map((loc) => readSitemap(page, loc, depth - 1))
  );

  return [...pages, ...children.flat()];
}

async function sitemapAddresses(page: Page): Promise<string[]> {
  const index = await page.request.get(`${SITE}/sitemap-index.xml`);

  return readSitemap(
    page,
    index.status() === 200
      ? `${SITE}/sitemap-index.xml`
      : `${SITE}/sitemap.xml`,
    SITEMAP_DEPTH
  );
}

test.describe("Public site", () => {
  /* TODO(@boringstack/maintainers): not debt, a setting: a stack without ROBOT_SITE_URL has no public site to check. */
  test.skip(SITE === "", "ROBOT_SITE_URL is not set");

  test("every page in the sitemap answers", async ({ page }) => {
    test.slow();

    const addresses = await sitemapAddresses(page);
    const failed: string[] = [];
    let next = 0;

    expect(addresses.length).toBeGreaterThanOrEqual(robotConfig.siteMinPages);

    const worker = async (): Promise<void> => {
      for (;;) {
        const address = addresses[next];

        next += 1;

        if (address === undefined) {
          return;
        }

        const res = await page.request.get(onSite(address), {
          maxRedirects: 0
        });
        const body = res.status() === 200 ? await res.text() : "";

        if (res.status() !== 200 || !/<h1[\s>]/u.test(body)) {
          failed.push(`${String(res.status())} ${address}`);
        }
      }
    };

    await Promise.all(Array.from({ length: SWEEP_AT_ONCE }, worker));
    expect(failed, "pages that did not answer with a page").toEqual([]);
  });

  test("the home page opens without errors and leads into the app", async ({
    page
  }) => {
    const problems = watchSite(page);

    await page.goto(SITE);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page
        .locator(`a[href^="${new URL(robotConfig.appURL).origin}"]`)
        .count(),
      "a link into the app"
    ).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  test("an address that does not exist gets the not-found page", async ({
    page
  }) => {
    const res = await page.goto(`${SITE}/this-page-does-not-exist`);

    expect(res?.status()).toBe(404);
  });
});
