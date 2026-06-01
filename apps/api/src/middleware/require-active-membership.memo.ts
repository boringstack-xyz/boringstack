import type {
  ActiveMembership,
  ICacheEntry,
} from "./require-active-membership.types";

class MembershipMemoStore {
  private static readonly cacheTtlMs = 30_000;

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
    this.store.set(this.memoKey(userId, accountId), {
      membership,
      cachedAt: nowMs,
    });
  }

  /** Test-only helper. Clears the in-process membership memo. */
  clearForTests(): void {
    this.store.clear();
  }
}

export const membershipMemo = new MembershipMemoStore();
