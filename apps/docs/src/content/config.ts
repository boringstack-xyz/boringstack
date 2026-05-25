import { defineCollection, z } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // "YYYY-MM": last manually-verified date. Surfaces as a small badge
        // next to reading time on time-sensitive pages (cost data, recipes,
        // runbooks). Distinct from git lastmod, which reflects any edit.
        verifiedOn: z
          .string()
          .regex(/^\d{4}-\d{2}$/, "verifiedOn must be YYYY-MM")
          .optional(),
      }),
    }),
  }),
};
