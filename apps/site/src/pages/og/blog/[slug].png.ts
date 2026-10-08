import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { renderSocialCard } from "../../../lib/social-card";
import { siteName } from "../../../lib/site";

export async function getStaticPaths() {
  const posts = await getCollection(
    "blog",
    ({ data }) => !data.draft && data.publishedAt <= new Date(),
  );
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { title: post.data.title, description: post.data.description },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { title, description } = props as {
    title: string;
    description: string;
  };
  const png = await renderSocialCard({
    title,
    description,
    eyebrow: `${siteName} blog`,
  });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
};
