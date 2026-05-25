import { z } from "zod";

export const widgetFormSchema = z.object({
  name: z.string().trim().min(1).max(200)
});
