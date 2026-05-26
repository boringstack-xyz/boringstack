import { and, eq } from "drizzle-orm";
import { db } from "../../../clients/postgres";
import { userAuthProviders, users } from "../../../clients/postgres/schema";
import { env } from "../../../config/env";
import { AUDIT_ACTIONS, auditLogService } from "../../../lib/audit-log";
import { ApiErrors } from "../../../lib/errors";
import { notifications } from "../../../lib/notifications";
import { canDisconnect, type IOAuthProfile } from "../../../lib/oauth";
import { now } from "../../../lib/time/now";
import { accountsService } from "../../accounts";
import { authWelcomeEvent } from "../../notifications/events";
import type { IOAuthLoginResult } from "../auth.types";
import { EMAIL_PROVIDER_KEY } from "../auth.constants";
import { normalizeEmail, toPublicUser } from "../auth.utils";

/**
 * OAuth signup/login. Every branch converges on
 * `accountsService.provisionAfterVerification`, so every authenticated
 * user leaves this service with an active owner membership regardless
 * of which branch handled them:
 *
 *   1. existing provider link       → reuse user
 *   2. user with same email exists  → link the new provider, promote
 *                                     `emailVerifiedAt` if the IdP
 *                                     asserts verification
 *   3. no user                      → create one, marked verified
 *
 * The whole flow runs in one DB transaction so the unverified-email
 * guard's throw rolls back any provider-link insert.
 */
export class OAuthAuthService {
  async loginOrRegisterFromProfile(
    providerName: string,
    profile: IOAuthProfile
  ): Promise<IOAuthLoginResult> {
    const email = normalizeEmail(profile.email);

    const result = await db.transaction(async (tx) => {
      const link = await tx.query.userAuthProviders.findFirst({
        where: and(
          eq(userAuthProviders.provider, providerName),
          eq(userAuthProviders.providerUserId, profile.providerUserId)
        ),
      });

      let userRow: typeof users.$inferSelect | undefined;
      let isNew = false;

      if (link) {
        userRow = await tx.query.users.findFirst({
          where: eq(users.id, link.userId),
        });

        if (!userRow) {
          await tx
            .delete(userAuthProviders)
            .where(eq(userAuthProviders.id, link.id));
        }
      }

      if (userRow === undefined) {
        const existingByEmail = await tx.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (existingByEmail) {
          await tx.insert(userAuthProviders).values({
            userId: existingByEmail.id,
            provider: providerName,
            providerUserId: profile.providerUserId,
          });

          if (
            profile.emailVerified &&
            existingByEmail.emailVerifiedAt === null
          ) {
            const [promoted] = await tx
              .update(users)
              .set({ emailVerifiedAt: now() })
              .where(eq(users.id, existingByEmail.id))
              .returning();

            userRow = promoted ?? existingByEmail;
          } else {
            userRow = existingByEmail;
          }
        } else {
          const [created] = await tx
            .insert(users)
            .values({
              email,
              firstName: profile.firstName,
              lastName: profile.lastName,
              emailVerifiedAt: profile.emailVerified ? now() : null,
            })
            .returning();

          if (!created) {
            throw ApiErrors.internal(
              "Failed to create user from OAuth profile"
            );
          }

          await tx.insert(userAuthProviders).values({
            userId: created.id,
            provider: providerName,
            providerUserId: profile.providerUserId,
          });

          userRow = created;
          isNew = true;
        }
      }

      /*
       * Refuse to issue a session for a user the provider didn't
       * verify — without this guard, an attacker who controls an
       * unverified-email account at an OAuth provider could grab a
       * BoringStack session for the same address. Keep the user row
       * and the link (so the next verified callback completes the
       * upgrade) and surface a distinct error to the route.
       */
      if (userRow.emailVerifiedAt === null) {
        throw ApiErrors.emailNotVerified();
      }

      const provisioned = await accountsService.provisionAfterVerification(
        { userId: userRow.id },
        tx
      );

      return {
        user: userRow,
        accountId: provisioned.account.id,
        isNew,
      };
    });

    void auditLogService.record({
      userId: result.user.id,
      action: result.isNew
        ? AUDIT_ACTIONS.AUTH_OAUTH_REGISTER
        : AUDIT_ACTIONS.AUTH_OAUTH_LOGIN,
      metadata: { provider: providerName },
    });

    if (result.isNew) {
      void notifications.send(authWelcomeEvent, {
        recipientUserId: result.user.id,
        payload: {
          firstName: result.user.firstName,
          dashboardUrl: `${env.FRONTEND_URL}/dashboard`,
        },
      });
    }

    return {
      user: toPublicUser(result.user),
      accountId: result.accountId,
      isNew: result.isNew,
    };
  }

  async linkProviderFromProfile(
    userId: string,
    providerName: string,
    profile: IOAuthProfile
  ): Promise<void> {
    const email = normalizeEmail(profile.email);

    await db.transaction(async (tx) => {
      const userRow = await tx.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!userRow) {
        throw ApiErrors.notFound("User");
      }

      if (normalizeEmail(userRow.email) !== email) {
        throw ApiErrors.validation(
          "OAuth email does not match your account email",
          "email"
        );
      }

      if (!profile.emailVerified) {
        throw ApiErrors.validation(
          "OAuth provider did not verify this email",
          "email"
        );
      }

      const existingLink = await tx.query.userAuthProviders.findFirst({
        where: and(
          eq(userAuthProviders.provider, providerName),
          eq(userAuthProviders.providerUserId, profile.providerUserId)
        ),
      });

      if (existingLink && existingLink.userId !== userId) {
        throw ApiErrors.conflict(
          "This provider account is linked to another user"
        );
      }

      const ownLink = await tx.query.userAuthProviders.findFirst({
        where: and(
          eq(userAuthProviders.userId, userId),
          eq(userAuthProviders.provider, providerName)
        ),
      });

      if (ownLink) {
        return;
      }

      await tx.insert(userAuthProviders).values({
        userId,
        provider: providerName,
        providerUserId: profile.providerUserId,
      });
    });

    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_OAUTH_LINKED,
      metadata: { provider: providerName },
    });
  }

  async disconnectProvider(
    userId: string,
    providerName: string
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const providers = await tx.query.userAuthProviders.findMany({
        where: eq(userAuthProviders.userId, userId),
      });

      const decision = canDisconnect(
        providers,
        providerName,
        EMAIL_PROVIDER_KEY
      );

      if (!decision.ok) {
        if (decision.reason === "Provider link not found") {
          throw ApiErrors.notFound("Provider link");
        }

        throw ApiErrors.validation(decision.reason, "provider");
      }

      const target = providers.find((row) => row.provider === providerName);

      if (target === undefined) {
        /*
         * canDisconnect already returned ok here; this satisfies the
         * narrowing for the subsequent .id access without an assertion.
         */
        throw ApiErrors.notFound("Provider link");
      }

      if (decision.action === "clear-password") {
        await tx
          .update(userAuthProviders)
          .set({ passwordHash: "" })
          .where(eq(userAuthProviders.id, target.id));

        return;
      }

      await tx
        .delete(userAuthProviders)
        .where(eq(userAuthProviders.id, target.id));
    });

    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_OAUTH_DISCONNECTED,
      metadata: { provider: providerName },
    });
  }

  async getLinkedProviders(userId: string): Promise<string[]> {
    const rows = await db.query.userAuthProviders.findMany({
      where: eq(userAuthProviders.userId, userId),
    });

    return rows
      .filter(
        (row) => row.provider !== EMAIL_PROVIDER_KEY || row.passwordHash !== ""
      )
      .map((row) => row.provider);
  }

  async hasPasswordLogin(userId: string): Promise<boolean> {
    const row = await db.query.userAuthProviders.findFirst({
      where: and(
        eq(userAuthProviders.userId, userId),
        eq(userAuthProviders.provider, EMAIL_PROVIDER_KEY)
      ),
    });

    return row !== undefined && row.passwordHash !== "";
  }
}

export const oauthAuthService = new OAuthAuthService();
