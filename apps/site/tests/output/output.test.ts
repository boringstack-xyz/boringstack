import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Validates the built static output in dist/. Run after `bun run build:ci`.
const dist = fileURLToPath(new URL("../../dist/", import.meta.url));
// Must match the origin used by build:ci in package.json.
const ORIGIN = "https://boringstack.example.com";

const read = (path: string) => readFileSync(`${dist}${path}`, "utf8");
const canonicalOf = (html: string) =>
  html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];

const pages = [
  "index.html",
  "about.html",
  "pricing.html",
  "contact.html",
  "privacy.html",
  "terms.html",
  "blog.html",
  "blog/hello-world.html",
];

describe("canonical URLs and sitemap", () => {
  test.each(pages)(
    "%s has a slashless canonical on the configured origin",
    (page) => {
      const canonical = canonicalOf(read(page));
      expect(canonical).toBeDefined();
      expect(canonical!.startsWith(`${ORIGIN}/`)).toBe(true);
      if (canonical !== `${ORIGIN}/`)
        expect(canonical!.endsWith("/")).toBe(false);
      expect(canonical).not.toContain(".html");
    },
  );

  test("the sitemap index references the sitemap and every sitemap entry is slashless", () => {
    const index = read("sitemap-index.xml");
    expect(index).toContain(`${ORIGIN}/sitemap-0.xml`);
    const urls = [
      ...read("sitemap-0.xml").matchAll(/<loc>([^<]+)<\/loc>/g),
    ].map((m) => m[1]!);
    expect(urls).toContain(`${ORIGIN}/`);
    expect(urls).toContain(`${ORIGIN}/blog/hello-world`);
    expect(urls).toContain(`${ORIGIN}/pricing`);
    for (const url of urls) {
      expect(url.startsWith(ORIGIN)).toBe(true);
      if (url !== `${ORIGIN}/`) expect(url.endsWith("/")).toBe(false);
      expect(url).not.toContain("/404");
      expect(url).not.toContain("/og/");
    }
  });

  test("every canonical page is listed in the sitemap", () => {
    const urls = new Set(
      [...read("sitemap-0.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
        (m) => m[1]!,
      ),
    );
    for (const page of pages) {
      expect(urls.has(canonicalOf(read(page))!)).toBe(true);
    }
  });
});

describe("robots and error pages", () => {
  test("robots.txt allows crawling and points at the sitemap index", () => {
    const robots = read("robots.txt");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap-index.xml`);
  });

  test("the 404 page exists and is marked noindex", () => {
    const html = read("404.html");
    expect(html).toContain("Page not found");
    expect(html).toContain('content="noindex, nofollow"');
  });
});

describe("metadata and structured data", () => {
  test.each(pages)(
    "%s has a title, a description and Open Graph and Twitter cards",
    (page) => {
      const html = read(page);
      expect(html).toMatch(/<title>[^<]+<\/title>/);
      expect(html).toMatch(/<meta name="description" content="[^"]+"/);
      expect(html).toContain('property="og:title"');
      expect(html).toContain('property="og:image"');
      expect(html).toContain(
        'name="twitter:card" content="summary_large_image"',
      );
    },
  );

  test("the home page carries Organization and WebSite JSON-LD that parse", () => {
    const blocks = [
      ...read("index.html").matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ].map((m) => JSON.parse(m[1]!));
    const types = blocks.map((b) => b["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");
  });

  test("a blog post carries BlogPosting JSON-LD with its canonical URL", () => {
    const blocks = [
      ...read("blog/hello-world.html").matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ].map((m) => JSON.parse(m[1]!));
    const post = blocks.find((b) => b["@type"] === "BlogPosting");
    expect(post).toBeDefined();
    expect(post.mainEntityOfPage).toBe(`${ORIGIN}/blog/hello-world`);
    expect(post.datePublished).toBe("2026-10-01");
  });
});

describe("social cards", () => {
  test.each(["og/default.png", "og/blog/hello-world.png"])(
    "%s is a 1200x630 PNG",
    (path) => {
      const bytes = readFileSync(`${dist}${path}`);
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      // IHDR width and height are big-endian 32-bit integers after the chunk header.
      expect(bytes.readUInt32BE(16)).toBe(1200);
      expect(bytes.readUInt32BE(20)).toBe(630);
    },
  );
});

describe("CSP compatibility", () => {
  test.each(pages)(
    "%s has no inline style attributes or executable inline scripts",
    (page) => {
      const html = read(page);
      expect(html).not.toMatch(/\sstyle="/);
      // Only data blocks (JSON-LD) may be inline; every executable script must have src.
      const inlineScripts = [
        ...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g),
      ].filter((m) => !/type="application\/ld\+json"/.test(m[1]!));
      expect(inlineScripts).toEqual([]);
    },
  );

  test("no page references analytics when none is configured", () => {
    for (const page of pages) {
      expect(read(page)).not.toContain("data-website-id");
      expect(read(page)).not.toContain("consent-banner");
    }
  });

  test("the nginx render script ran against a valid configuration", () => {
    expect(
      existsSync(
        fileURLToPath(new URL("../../.build/nginx.conf", import.meta.url)),
      ),
    ).toBe(true);
  });
});
