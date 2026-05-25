import { z } from "zod";

export const renameAccountSchema = z.object({
  name: z.string().min(1, "Account name is required")
});
