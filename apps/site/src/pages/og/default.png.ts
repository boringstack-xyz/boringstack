import type { APIRoute } from "astro";
import { renderSocialCard } from "../../lib/social-card";
import { siteName, siteTagline } from "../../lib/site";

export const GET: APIRoute = async () => {
  const png = await renderSocialCard({
    title: siteName,
    description: siteTagline,
  });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
};
