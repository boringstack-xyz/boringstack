import { and, eq, gt } from "drizzle-orm";
import { db } from "../../../clients/postgres";
import {
  accountMemberships,
  emailVerificationTokens,
  users,
} from "../../../clients/postgres/schema";
import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { AUDIT_ACTIONS, auditLogService } from "../../../lib/audit-log";
import {
  emailSuppressionService,
  normalizeEmail,
  sendTemplate,
} from "../../../lib/email";
import { ApiErrors, getErrorMessage } from "../../../lib/errors";
import { notifications } from "../../../lib/notifications";
import { now, nowMs } from "../../../lib/time/now";
import { generateOpaqueToken, hashOpaqueToken } from "../../../lib/tokens";
import { accountsService } from "../../accounts";
import { authWelcomeEvent } from "../../notifications/events";
import {
  EMAIL_SUBJECTS,
  ENUMERATION_SAFE_MESSAGES,
  TEMPLATE_PATHS,
  VERIFICATION_TTL_MS,
} from "../auth.constants";
import type { IAuthenticatedResult, IMessageResult } from "../auth.types";
import { toPublicUser } from "../auth.utils";

export class EmailVerificationService {
  /**
   * Flips `users.email_verified_at` and atomically calls the personal-
   * account convergence point. After this returns the user is fully
   * provisioned (account + owner membership) so the route can sign a
   * JWT with the freshly-resolved `aid`.
   */
  async verify(token: string): Promise<IAuthenticatedResult> {
    const tokenHash = hashOpaqueToken(token);
    const record = await db.query.emailVerificationTokens.findFirst({
      where: and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        gt(emailVerificationTokens.expiresAt, now())
      ),
    });

    if (!record) {
      throw ApiErrors.invalidInput("Invalid or expired verification token");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, record.userId),
    });

    if (!user) {
      throw ApiErrors.notFound("User");
    }

    if (user.emailVerifiedAt !== null) {
      throw ApiErrors.invalidInput("Email already verified");
    }

    const verifiedAt = now();

    const provisioned = await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ emailVerifiedAt: verifiedAt, updatedAt: verifiedAt })
        .where(eq(users.id, user.id));
      await tx
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.tokenHash, tokenHash));

      return accountsService.provisionAfterVerification(
        { userId: user.id },
        tx
      );
    });

    /*
     * Successful verification proves the user controls this inbox right
     * now. If the address ever landed on the suppression list (e.g. a
     * prior signup attempt bounced before the user fixed the mailbox),
     * clear it so transactional mail starts flowing immediately.
     */
    void emailSuppressionService.clear(user.email);

    void auditLogService.record({
      userId: user.id,
      action: AUDIT_ACTIONS.AUTH_EMAIL_VERIFIED,
    });

    void auditLogService.record({
      userId: user.id,
      action: AUDIT_ACTIONS.AUTH_ACCOUNT_PROVISIONED,
      resource: `account:${provisioned.account.id}`,
    });

    void notifications.send(authWelcomeEvent, {
      recipientUserId: user.id,
      payload: {
        firstName: user.firstName,
        dashboardUrl: `${env.FRONTEND_URL}/dashboard`,
      },
    });

    return {
      user: toPublicUser({ ...user, emailVerifiedAt: verifiedAt }),
      accountId: provisioned.account.id,
    };
  }

  /**
   * Test-only seam used by the Playwright fixture to skip the email
   * round-trip when seeding accounts. Marks the user verified and
   * provisions the personal account in one transaction — same effect
   * as a real `verify(token)` call, but keyed by email so the fixture
   * doesn't need to read the (hashed) token out of the DB.
   *
   * Route-level guard refuses to wire this endpoint outside
   * `NODE_ENV=test`; keeping the service method available everywhere
   * still doesn't open a production hole because no route surfaces it.
   */
  async forceVerifyForTests(email: string): Promise<IAuthenticatedResult> {
    const normalized = normalizeEmail(email);
    const user = await db.query.users.findFirst({
      where: eq(users.email, normalized),
    });

    if (!user) {
      throw ApiErrors.notFound("User");
    }

    if (user.emailVerifiedAt !== null) {
      const memberships = await db.query.accountMemberships.findFirst({
        where: eq(accountMemberships.userId, user.id),
      });

      if (memberships) {
        return {
          user: toPublicUser(user),
          accountId: memberships.accountId,
        };
      }
    }

    const verifiedAt = now();

    const provisioned = await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ emailVerifiedAt: verifiedAt, updatedAt: verifiedAt })
        .where(eq(users.id, user.id));
      await tx
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, user.id));

      return accountsService.provisionAfterVerification(
        { userId: user.id },
        tx
      );
    });

    return {
      user: toPublicUser({ ...user, emailVerifiedAt: verifiedAt }),
      accountId: provisioned.account.id,
    };
  }

  async resend(email: string): Promise<IMessageResult> {
    const normalized = normalizeEmail(email);
    const user = await db.query.users.findFirst({
      where: eq(users.email, normalized),
    });

    if (user?.emailVerifiedAt === null) {
      const token = generateOpaqueToken();
      const expiresAt = new Date(nowMs() + VERIFICATION_TTL_MS).toISOString();

      await db.transaction(async (tx) => {
        await tx
          .delete(emailVerificationTokens)
          .where(eq(emailVerificationTokens.userId, user.id));
        await tx.insert(emailVerificationTokens).values({
          userId: user.id,
          tokenHash: hashOpaqueToken(token),
          expiresAt,
        });
      });

      void sendTemplate({
        to: user.email,
        subject: EMAIL_SUBJECTS.CONFIRM_EMAIL,
        templatePath: TEMPLATE_PATHS.CONFIRM_EMAIL,
        variables: {
          preHeader: "Click the button below to verify your email",
          token,
          confirmationUrl: `${env.FRONTEND_URL}/verify-email`,
        },
      }).catch((error: unknown) => {
        logger.error("Verification email dispatch failed", {
          event: "auth.verification_resent.email_failed",
          userId: user.id,
          error: getErrorMessage(error),
        });
      });

      void auditLogService.record({
        userId: user.id,
        action: AUDIT_ACTIONS.AUTH_VERIFICATION_RESENT,
      });
    }

    return { message: ENUMERATION_SAFE_MESSAGES.RESEND_VERIFICATION };
  }
}

export const emailVerificationService = new EmailVerificationService();
