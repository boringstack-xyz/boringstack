import type { z } from "zod";

import type { envSchema } from "./schema";

export type IEnv = z.infer<typeof envSchema>;
