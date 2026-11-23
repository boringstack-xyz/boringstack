import { and, eq, inArray, isNull, like, lt } from "drizzle-orm";

import { db } from "../../../clients/postgres";
import {
  accountMemberships,
  accountPlans,
  accounts,
  plans,
  users,
} from "../../../clients/postgres/schema";
import { logger } from "../../../config/logger";
import { ROLE } from "../../../lib/acl";
import { normalizeEmail } from "../../../lib/email";
import { ApiErrors } from "../../../lib/errors";
import {
  isSyntheticEmail,
  SYNTHETIC_ACCOUNT_MAX_AGE_MS,
  SYNTHETIC_EMAIL_DOMAIN,
  SYNTHETIC_PLAN_SOURCE,
} from "../../../lib/synthetic";
import { now, nowMs } from "../../../lib/time/now";
import { ensureBuiltInPlans, PLAN_NAME } from "../../billing";
import type { IAuthenticatedResult } from "../auth.types";
import { emailVerificationService } from "./email-verification.service";

/**
 * The verification robot's two privileges, and nothing more: verify one of
 * its own addresses without the email round-trip, and remove its accounts
 * afterwards. Every method refuses an address outside the reserved robot
 * domain, so holding the secret never reaches a real person's account.
 */
export class SyntheticService {
  /** Verifies a robot sign-up and provisions its account, as the emailed link would. */
  async verify(email: string): Promise<IAuthenticatedResult> {
    return emailVerificationService.forceVerifyForTests(
      this.robotAddress(email)
    );
  }

  /** Removes one robot user and every account it owns. Safe to repeat. */
  async remove(email: string): Promise<{ removed: number }> {
    const address = this.robotAddress(email);
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, address));

    return { removed: await this.removeUsers(rows.map((row) => row.id)) };
  }

  /**
   * Puts the robot's own account on Pro, so it can walk what a paying
   * member uses. No money moves and no checkout is completed: the plan row
   * is marked `synthetic`, and goes with the account at cleanup.
   */
  async upgrade(email: string): Promise<{ upgraded: boolean }> {
    const address = this.robotAddress(email);
    const [robot] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, address));
    const [owned] = await db
      .select({ accountId: accountMemberships.accountId })
      .from(accountMemberships)
      .where(
        and(
          inArray(accountMemberships.userId, robot ? [robot.id] : []),
          eq(accountMemberships.role, ROLE.owner)
        )
      )
      .limit(1);

    /* The plan rows are written on first read of the price list; a new stack may not have had one. */
    await ensureBuiltInPlans();

    const pro = await db.query.plans.findFirst({
      where: eq(plans.name, PLAN_NAME.pro),
    });

    if (owned === undefined || pro === undefined) {
      throw ApiErrors.notFound("Resource");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(accountPlans)
        .set({ revokedAt: now() })
        .where(
          and(
            eq(accountPlans.accountId, owned.accountId),
            isNull(accountPlans.revokedAt)
          )
        );
      await tx.insert(accountPlans).values({
        accountId: owned.accountId,
        planId: pro.id,
        status: "active",
        source: SYNTHETIC_PLAN_SOURCE,
      });
    });

    return { upgraded: true };
  }

  /** Removes robot users a dead run left behind. Run by account maintenance. */
  async sweepLeftovers(): Promise<{ swept: number }> {
    const cutoff = new Date(
      nowMs() - SYNTHETIC_ACCOUNT_MAX_AGE_MS
    ).toISOString();
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          like(users.email, `%@${SYNTHETIC_EMAIL_DOMAIN}`),
          lt(users.createdAt, cutoff)
        )
      );
    const swept = await this.removeUsers(rows.map((row) => row.id));

    if (swept > 0) {
      logger.info("Removed leftover verification robot users", {
        event: "auth.synthetic.swept",
        count: swept,
      });
    }

    return { swept };
  }

  private robotAddress(email: string): string {
    const address = normalizeEmail(email);

    if (!isSyntheticEmail(address)) {
      throw ApiErrors.notFound("Resource");
    }

    return address;
  }

  /*
   * Accounts go first: their rows cascade to everything the robot made
   * (memberships, invitations, plans), and the user row cannot go while it still
   * owns one.
   */
  private async removeUsers(userIds: readonly string[]): Promise<number> {
    if (userIds.length === 0) {
      return 0;
    }

    const ids = [...userIds];

    return db.transaction(async (tx) => {
      const owned = await tx
        .select({ accountId: accountMemberships.accountId })
        .from(accountMemberships)
        .where(
          and(
            inArray(accountMemberships.userId, ids),
            eq(accountMemberships.role, ROLE.owner)
          )
        );

      if (owned.length > 0) {
        await tx.delete(accounts).where(
          inArray(
            accounts.id,
            owned.map((row) => row.accountId)
          )
        );
      }

      const removed = await tx
        .delete(users)
        .where(inArray(users.id, ids))
        .returning({ id: users.id });

      return removed.length;
    });
  }
}

export const syntheticService = new SyntheticService();
