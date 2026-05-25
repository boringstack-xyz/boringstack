import type { ActiveMembership } from "../api/accounts/accounts.types";

export type { ActiveMembership };

export interface ICacheEntry {
  readonly membership: ActiveMembership;
  readonly cachedAt: number;
}
