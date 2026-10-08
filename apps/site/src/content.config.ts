import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

// Blog posts are flat Markdown files in src/content/blog. The filename (without
// .md) is the permanent URL slug, so renaming a published post breaks its link.
const blog = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string().min(1).max(120),
    description: z.string().min(1).max(200),
    // YYYY-MM-DD. A future date stays unpublished until a build on or after it.
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    author: z.string().default("BoringStack team"),
    // Drafts default to true so a new file cannot publish by accident.
    draft: z.boolean().default(true),
  }),
});

export const collections = { blog };
