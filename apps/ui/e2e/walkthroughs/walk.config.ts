import { z } from "zod";

/** An unset or empty variable reads as "not given". */
const given = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === "" ? undefined : value.trim();

/**
 * What `bun run factory walk` hands a walkthrough: the stack being walked
 * and the folder its screenshots go to. Like robot.config.ts, the only place
 * walkthroughs read the environment.
 */
export const walkConfig = z
  .object({
    baseURL: z.url().optional(),
    outputDir: z.string().min(1).optional()
  })
  .parse({
    baseURL: given(process.env.FACTORY_BASE_URL),
    outputDir: given(process.env.FACTORY_WALK_DIR)
  });
