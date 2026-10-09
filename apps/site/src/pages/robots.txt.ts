import type { APIRoute } from "astro";
import { siteConfig } from "../lib/site-config";

export const GET: APIRoute = () => {
  const body = siteConfig.indexable
    ? `User-agent: *\nAllow: /\n\nSitemap: ${siteConfig.siteUrl}/sitemap-index.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
