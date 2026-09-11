import { z } from "zod";

/** One validated endpoint for browser tests and their API setup requests. */
export const e2eConfig = z
  .object({
    baseURL: z.url()
  })
  .parse({
    baseURL:
      process.env.E2E_API_BASE_URL ??
      `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "7331"}`
  });
