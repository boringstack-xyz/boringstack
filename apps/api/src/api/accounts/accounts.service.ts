import { and, asc, eq, isNull } from "drizzle-orm";

import { ROLE } from "../../lib/acl";

import { db } from "../../clients/postgres";
import {
  accountMemberships,
  accounts,
  users,
} from "../../clients/postgres/schema";
import { env } from "../../config/env";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { extractDomain, isPublicEmailDomain } from "../../lib/email-domain";
import { ApiErrors } from "../../lib/errors";
import { now } from "../../lib/time/now";

import { buildPersonalAccountName, toActiveMembership } from "./accounts.utils";
import type {
  ActiveMembership,
  DbOrTx,
  ICreatePersonalAccountResult,
  IProvisionAfterVerificationInput,
} from "./accounts.types";

export class AccountsService {
  /**
   * Single convergence point for personal-account provisioning. Called
   * by the password verify-email handler and by the OAuth callback
   * (after the provider's verified email is trusted). Idempotent: if
   * the user already holds an active owner membership the existing row
   * is returned without writes, so a duplicate verify click or an
   * OAuth-then-password collision is safe to retry.
   *
   * `name` is optional; production callers omit it and the personal
   * account name is derived from the user's profile, while tests can
   * pin a specific name for readable assertions.
   */
  async provisionAfterVerification(
    input: IProvisionAfterVerificationInput,
    tx?: DbOrTx
  ): Promise<ICreatePersonalAccountResult> {
    if (tx === undefined) {
      return db.transaction(async (innerTx) =>
        this.provisionAfterVerification(input, innerTx)
      );
    }

    const existing = await tx
      .select({ account: accounts, membership: accountMemberships })
      .from(accountMemberships)
      .innerJoin(accounts, eq(accounts.id, accountMemberships.accountId))
      .where(
        and(
          eq(accountMemberships.userId, input.userId),
          eq(accountMemberships.role, ROLE.owner),
          isNull(accountMemberships.revokedAt),
          isNull(accounts.deletedAt)
        )
      )
      .limit(1);

    const first = existing[0];

    if (first !== undefined) {
      return { account: first.account, membership: first.membership };
    }

    const claimedDomain = await this.resolveDomainClaim(input.userId, tx);
    const resolvedName = await this.resolveAccountName(input, tx);

    const [account] = await tx
      .insert(accounts)
      .values({ name: resolvedName, claimedDomain })
      .returning();

    if (!account) {
      throw ApiErrors.database("Failed to create account row");
    }

    const [membership] = await tx
      .insert(accountMemberships)
      .values({
        accountId: account.id,
        userId: input.userId,
        role: ROLE.owner,
      })
      .returning();

    if (!membership) {
      throw ApiErrors.database("Failed to create owner membership");
    }

    void auditLogService.record({
      userId: input.userId,
      action: AUDIT_ACTIONS.ACCOUNT_CREATED,
      resource: `account:${account.id}`,
      metadata: { name: account.name },
    });

    return { account, membership };
  }

  async getMembershipsForUser(userId: string): Promise<ActiveMembership[]> {
    const rows = await db
      .select({ membership: accountMemberships })
      .from(accountMemberships)
      .innerJoin(accounts, eq(accounts.id, accountMemberships.accountId))
      .where(
        and(
          eq(accountMemberships.userId, userId),
          isNull(accountMemberships.revokedAt),
          isNull(accounts.deletedAt)
        )
      )
      .orderBy(asc(accountMemberships.joinedAt));

    return rows.map((row) => toActiveMembership(row.membership));
  }

  async getActiveMembership(
    userId: string,
    accountId: string
  ): Promise<ActiveMembership | null> {
    const [row] = await db
      .select({ membership: accountMemberships })
      .from(accountMemberships)
      .innerJoin(accounts, eq(accounts.id, accountMemberships.accountId))
      .where(
        and(
          eq(accountMemberships.userId, userId),
          eq(accountMemberships.accountId, accountId),
          isNull(accountMemberships.revokedAt),
          isNull(accounts.deletedAt)
        )
      )
      .limit(1);

    return row === undefined ? null : toActiveMembership(row.membership);
  }

  /**
   * Atomically swaps the owner role: demotes the current owner to
   * `admin`, promotes the target membership to `owner`. The partial
   * unique index on (account_id WHERE role='owner') is never violated
   * mid-transaction.
   */
  async transferOwnership(
    accountId: string,
    fromUserId: string,
    toUserId: string,
    actorUserId: string
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const [target] = await tx
        .select()
        .from(accountMemberships)
        .where(
          and(
            eq(accountMemberships.accountId, accountId),
            eq(accountMemberships.userId, toUserId),
            isNull(accountMemberships.revokedAt)
          )
        )
        .limit(1);

      if (!target) {
        throw ApiErrors.notFound("Target membership");
      }

      /*
       * Demote the outgoing owner first so the partial unique index
       * never sees two `owner` rows simultaneously.
       */
      await tx
        .update(accountMemberships)
        .set({ role: ROLE.admin, updatedAt: now() })
        .where(
          and(
            eq(accountMemberships.accountId, accountId),
            eq(accountMemberships.userId, fromUserId),
            eq(accountMemberships.role, ROLE.owner),
            isNull(accountMemberships.revokedAt)
          )
        );

      await tx
        .update(accountMemberships)
        .set({ role: ROLE.owner, updatedAt: now() })
        .where(
          and(
            eq(accountMemberships.id, target.id),
            eq(accountMemberships.accountId, accountId)
          )
        );

      void auditLogService.record({
        userId: actorUserId,
        action: AUDIT_ACTIONS.ACCOUNT_OWNER_TRANSFERRED,
        resource: `account:${accountId}`,
        metadata: { fromUserId, toUserId },
      });
    });
  }

  /**
   * Soft-deletes the account by setting `deletedAt`. A background
   * job hard-deletes the row after the configured grace window (the
   * `app.accounts.deletedAt` column is indexed so the sweep is cheap).
   */
  async softDelete(accountId: string, actorUserId: string): Promise<void> {
    const [updated] = await db
      .update(accounts)
      .set({ deletedAt: now(), updatedAt: now() })
      .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
      .returning({ id: accounts.id });

    if (!updated) {
      throw ApiErrors.notFound("Account");
    }

    void auditLogService.record({
      userId: actorUserId,
      action: AUDIT_ACTIONS.ACCOUNT_DELETED,
      resource: `account:${accountId}`,
    });
  }

  async updateName(
    accountId: string,
    name: string,
    actorUserId: string
  ): Promise<{ id: string; name: string }> {
    const trimmed = name.trim();

    if (trimmed === "") {
      throw ApiErrors.validation("Account name is required", "name");
    }

    const [updated] = await db
      .update(accounts)
      .set({ name: trimmed, updatedAt: now() })
      .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
      .returning({ id: accounts.id, name: accounts.name });

    if (!updated) {
      throw ApiErrors.notFound("Account");
    }

    void auditLogService.record({
      userId: actorUserId,
      action: AUDIT_ACTIONS.ACCOUNT_UPDATED,
      resource: `account:${accountId}`,
      metadata: { name: updated.name },
    });

    return updated;
  }

  /**
   * Verifies the user holds an active membership in the target
   * account and returns it so the route handler can re-issue the JWT
   * with the new `aid`. Records an audit row so cross-account hops
   * leave a paper trail.
   */
  async switchAccount(
    userId: string,
    targetAccountId: string
  ): Promise<ActiveMembership> {
    const membership = await this.getActiveMembership(userId, targetAccountId);

    if (!membership) {
      throw ApiErrors.forbidden("You are not a member of that account");
    }

    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.ACCOUNT_SWITCHED,
      resource: `account:${targetAccountId}`,
    });

    return membership;
  }

  /**
   * Decides whether the new personal account should claim the user's
   * email domain. Off entirely when `ACCOUNT_DOMAIN_CLAIMING=false`.
   * Domains on the public-allowlist (gmail.com, etc.) always return
   * null — those are never tenant-scoped. Throws `DomainClaimed` when
   * another active account already owns the domain so the verify /
   * OAuth-callback handlers can render an actionable error.
   */
  private async resolveDomainClaim(
    userId: string,
    tx: DbOrTx
  ): Promise<string | null> {
    if (!env.ACCOUNT_DOMAIN_CLAIMING) {
      return null;
    }

    const user = await tx.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return null;
    }

    const domain = extractDomain(user.email);

    if (domain === null || isPublicEmailDomain(domain)) {
      return null;
    }

    const [claimed] = await tx
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(
        and(eq(accounts.claimedDomain, domain), isNull(accounts.deletedAt))
      )
      .limit(1);

    if (claimed) {
      throw ApiErrors.domainClaimed(claimed.name, {
        accountId: claimed.id,
        domain,
      });
    }

    return domain;
  }

  private async resolveAccountName(
    input: IProvisionAfterVerificationInput,
    tx: DbOrTx
  ): Promise<string> {
    if (input.name !== undefined && input.name !== "") {
      return input.name;
    }

    const user = await tx.query.users.findFirst({
      where: eq(users.id, input.userId),
    });

    if (!user) {
      throw ApiErrors.notFound("User");
    }

    return buildPersonalAccountName({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    });
  }
}

export const accountsService = new AccountsService();
