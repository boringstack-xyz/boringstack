import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../clients/postgres";
import { accounts, users } from "../../clients/postgres/schema";
import { env } from "../../config/env";
import { resolveAccountFeatures } from "../../lib/acl/resolve-account-features";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { ApiErrors } from "../../lib/errors";
import { now } from "../../lib/time/now";
import { accountsService } from "../accounts";
import { oauthAuthService } from "../auth/services";
import type {
  ICreateUserData,
  IMembershipSummary,
  IMeResponse,
  IPublicUserProfile,
  IUpdateUserData,
  IUser,
} from "./users.types";
import { toPublicUserProfile } from "./users.utils";

export class UsersService {
  async getById(id: string): Promise<IUser | undefined> {
    return db.query.users.findFirst({ where: eq(users.id, id) });
  }

  async create(data: ICreateUserData): Promise<IUser> {
    const [created] = await db.insert(users).values(data).returning();

    if (!created) {
      throw ApiErrors.internal("Failed to create user");
    }

    void auditLogService.record({
      userId: created.id,
      action: AUDIT_ACTIONS.USER_CREATED,
    });

    return created;
  }

  async getProfile(userId: string): Promise<IPublicUserProfile> {
    const user = await this.getById(userId);

    if (!user) {
      throw ApiErrors.notFound("User");
    }

    return toPublicUserProfile(user);
  }

  async getMe(userId: string, accountId: string): Promise<IMeResponse> {
    const [user, account, activeMembership, allMemberships] = await Promise.all(
      [
        this.getById(userId),
        db.query.accounts.findFirst({
          where: and(eq(accounts.id, accountId), isNull(accounts.deletedAt)),
        }),
        accountsService.getActiveMembership(userId, accountId),
        accountsService.getMembershipsForUser(userId),
      ]
    );

    if (!user) {
      throw ApiErrors.notFound("User");
    }

    if (!account) {
      throw ApiErrors.notFound("Account");
    }

    if (!activeMembership) {
      throw ApiErrors.forbidden("No active membership for the JWT account");
    }

    const features = await resolveAccountFeatures(accountId);
    const [authProviders, hasPasswordLogin] = await Promise.all([
      oauthAuthService.getLinkedProviders(userId),
      oauthAuthService.hasPasswordLogin(userId),
    ]);

    const accountIds = allMemberships.map((membership) => membership.accountId);
    const accountRows =
      accountIds.length === 0
        ? []
        : await db.query.accounts.findMany({
            where: (table, { and: andOp, inArray, isNull: isNullOp }) =>
              andOp(inArray(table.id, accountIds), isNullOp(table.deletedAt)),
          });
    const accountNameMap = new Map(
      accountRows.map((row) => [row.id, row.name])
    );

    const memberships: IMembershipSummary[] = allMemberships.map(
      (membership) => ({
        accountId: membership.accountId,
        accountName: accountNameMap.get(membership.accountId) ?? "",
        role: membership.role,
      })
    );

    return {
      user: toPublicUserProfile(user),
      account: { id: account.id, name: account.name },
      role: activeMembership.role,
      memberships,
      features,
      capabilities: {
        billing: env.BILLING_ENABLED,
        notificationsSse: env.NOTIFICATIONS_SSE_ENABLED,
        webPush:
          env.WEB_PUSH_VAPID_PUBLIC !== "" &&
          env.WEB_PUSH_VAPID_PRIVATE !== "" &&
          env.WEB_PUSH_VAPID_SUBJECT !== "",
      },
      authProviders,
      hasPasswordLogin,
    };
  }

  async updateProfile(
    userId: string,
    data: IUpdateUserData
  ): Promise<IPublicUserProfile> {
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: now() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      throw ApiErrors.notFound("User");
    }

    void auditLogService.record({
      userId: updated.id,
      action: AUDIT_ACTIONS.USER_PROFILE_UPDATED,
    });

    return toPublicUserProfile(updated);
  }
}

export const usersService = new UsersService();
