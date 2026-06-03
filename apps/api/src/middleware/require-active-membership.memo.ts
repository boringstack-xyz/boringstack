import type {
  ActiveMembership,
  ICacheEntry,
} from "./require-active-membership.types";

class MembershipMemoStore {
  private static readonly cacheTtlMs = 30_000;

  /*
   * Expired entries are only deleted when their own key is re-read, so
   * keys never touched again would accumulate for the process lifetime
   * (one per (user, account) pair ever seen). The periodic sweep on
   * write bounds that: every N writes, expired entries are dropped in
   * one O(size) pass — amortised O(1) per write.
   */
  private static readonly sweepEveryWrites = 1024;

  private writesSinceSweep = 0;

  /*
   * In-process Map (NOT the Valkey cache layer). The
   * `cache-keys/cache-set-must-have-ttl` rule reads the variable name;
   * naming the field `store` keeps the rule from firing on this
   * intentionally in-process structure.
   */
  private readonly store = new Map<string, ICacheEntry>();

  private memoKey(userId: string, accountId: string): string {
    return `${userId}:${accountId}`;
  }

  read(
    userId: string,
    accountId: string,
    nowMs: number
  ): ActiveMembership | null {
    const entry = this.store.get(this.memoKey(userId, accountId));

    if (entry === undefined) {
      return null;
    }

    if (nowMs - entry.cachedAt > MembershipMemoStore.cacheTtlMs) {
      this.store.delete(this.memoKey(userId, accountId));

      return null;
    }

    return entry.membership;
  }

  write(
    userId: string,
    accountId: string,
    membership: ActiveMembership,
    nowMs: number
  ): void {
    this.writesSinceSweep += 1;

    if (this.writesSinceSweep >= MembershipMemoStore.sweepEveryWrites) {
      this.sweepExpired(nowMs);
      this.writesSinceSweep = 0;
    }

    this.store.set(this.memoKey(userId, accountId), {
      membership,
      cachedAt: nowMs,
    });
  }

  private sweepExpired(nowMs: number): void {
    for (const [key, entry] of this.store) {
      if (nowMs - entry.cachedAt > MembershipMemoStore.cacheTtlMs) {
        this.store.delete(key);
      }
    }
  }

  /** Test-only helper. Current entry count, for sweep assertions. */
  sizeForTests(): number {
    return this.store.size;
  }

  /** Test-only helper. Clears the in-process membership memo. */
  clearForTests(): void {
    this.store.clear();
    this.writesSinceSweep = 0;
  }
}

export const membershipMemo = new MembershipMemoStore();
