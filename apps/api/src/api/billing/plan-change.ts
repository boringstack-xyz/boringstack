/*
 * What counts as an account changing plan. Stripe describes one purchase
 * with several events and a renewal with more; only a move onto or off a
 * paid plan is a change.
 */

/** The plan row facts that decide what an account pays for. */
export interface IPlanStanding {
  planId: number;
  status: string;
}

/** The plan statuses under which an account is paying and entitled. */
export const PAID_PLAN_STATUSES = ["active", "trialing"] as const;

/** The plan an account is paying for: its plan while the status entitles it, none otherwise. */
export const paidPlanId = (
  standing: IPlanStanding | undefined
): number | null =>
  standing !== undefined &&
  PAID_PLAN_STATUSES.some((status) => status === standing.status)
    ? standing.planId
    : null;
