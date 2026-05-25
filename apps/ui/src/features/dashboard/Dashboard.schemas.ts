import { z } from "zod";

export const dashboardSummarySchema = z.object({
  totalEvents: z.number().int().min(0),
  recentActivity: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      timestamp: z.string()
    })
  )
});
