import { now } from "../../../lib/time/now";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../../../clients/postgres";
import {
  passwordResetTokens,
  userAuthProviders,
  users,
} from "../../../clients/postgres/schema";
import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { AUDIT_ACTIONS, auditLogService } from "../../../lib/audit-log";
import { sendTemplate } from "../../../lib/email";
import { ApiErrors, getErrorMessage } from "../../../lib/errors";
import { passwordService } from "../../../lib/password";
import { generateOpaqueToken, hashOpaqueToken } from "../../../lib/tokens";
import {
  EMAIL_PROVIDER_KEY,
  EMAIL_SUBJECTS,
  ENUMERATION_SAFE_MESSAGES,
  RESET_TTL_MS,
  TEMPLATE_PATHS,
} from "../auth.constants";
import type { IMessageResult } from "../auth.types";
import { normalizeEmail } from "../auth.utils";
import { sessionService } from "./session.service";

export class PasswordResetService {
  async request(email: string): Promise<IMessageResult> {
    const normalized = normalizeEmail(email);
    const rows = await db
      .select({ user: users, authProvider: userAuthProviders })
      .from(users)
      .innerJoin(userAuthProviders, eq(users.id, userAuthProviders.userId))
      .where(
        and(
          eq(users.email, normalized),
          eq(userAuthProviders.provider, EMAIL_PROVIDER_KEY)
        )
      )
      .limit(1);
    const row = rows[0];

    if (row === undefined || row.authProvider.passwordHash === "") {
      return { message: ENUMERATION_SAFE_MESSAGES.REQUEST_PASSWORD_RESET };
    }

    const user = row.user;
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();

    await db.transaction(async (tx) => {
      await tx
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, user.id));

      await tx.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        expiresAt,
      });
    });

    void sendTemplate({
      to: user.email,
      subject: EMAIL_SUBJECTS.RESET_PASSWORD,
      templatePath: TEMPLATE_PATHS.RESET_PASSWORD,
      variables: {
        preHeader: "Click the button to reset your password",
        name: user.firstName,
        token,
        resetUrl: `${env.FRONTEND_URL}/reset-password`,
        dashboardUrl: `${env.FRONTEND_URL}/dashboard`,
      },
    }).catch((error: unknown) => {
      logger.error("Password reset email dispatch failed", {
        event: "auth.password_reset_requested.email_failed",
        userId: user.id,
        error: getErrorMessage(error),
      });
    });

    void auditLogService.record({
      userId: user.id,
      action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_REQUESTED,
    });

    return { message: ENUMERATION_SAFE_MESSAGES.REQUEST_PASSWORD_RESET };
  }

  async complete(token: string, newPassword: string): Promise<IMessageResult> {
    const tokenHash = hashOpaqueToken(token);
    const record = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        gt(passwordResetTokens.expiresAt, now())
      ),
    });

    if (!record) {
      throw ApiErrors.invalidInput("Invalid or expired reset token");
    }

    const passwordHash = await passwordService.hash(newPassword);

    await db.transaction(async (tx) => {
      const updatedProviders = await tx
        .update(userAuthProviders)
        .set({ passwordHash })
        .where(
          and(
            eq(userAuthProviders.userId, record.userId),
            eq(userAuthProviders.provider, EMAIL_PROVIDER_KEY)
          )
        )
        .returning({ id: userAuthProviders.id });

      if (updatedProviders.length === 0) {
        throw ApiErrors.invalidInput("Password login is not enabled");
      }

      await tx
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, record.userId));
    });

    await sessionService.revokeAllForUser(record.userId);

    const user = await db.query.users.findFirst({
      where: eq(users.id, record.userId),
    });

    if (user) {
      void sendTemplate({
        to: user.email,
        subject: EMAIL_SUBJECTS.PASSWORD_CHANGED,
        templatePath: TEMPLATE_PATHS.PASSWORD_CHANGED,
        variables: {
          preHeader: "Password change confirmation",
          email: user.email,
        },
      }).catch((error: unknown) => {
        logger.error("Failed to send password-changed notification", {
          event: "auth.password_reset.notification_email_failed",
          userId: user.id,
          error: getErrorMessage(error),
        });
      });
    }

    void auditLogService.record({
      userId: record.userId,
      action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_COMPLETED,
    });

    return { message: "Password updated successfully" };
  }
}

export const passwordResetService = new PasswordResetService();
