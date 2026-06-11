import { and, eq } from "drizzle-orm";

import { db } from "../../../clients/postgres";
import { userAuthProviders, users } from "../../../clients/postgres/schema";
import { logger } from "../../../config/logger";
import { AUDIT_ACTIONS, auditLogService } from "../../../lib/audit-log";
import { sendTemplate } from "../../../lib/email";
import { ApiErrors, getErrorMessage } from "../../../lib/errors";
import { passwordService } from "../../../lib/password";
import {
  EMAIL_PROVIDER_KEY,
  EMAIL_SUBJECTS,
  TEMPLATE_PATHS,
} from "../auth.constants";
import type { IMessageResult } from "../auth.types";
import { sessionService } from "./session.service";

export class PasswordChangeService {
  async change(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<IMessageResult> {
    const rows = await db
      .select({ user: users, authProvider: userAuthProviders })
      .from(users)
      .innerJoin(userAuthProviders, eq(users.id, userAuthProviders.userId))
      .where(
        and(
          eq(users.id, userId),
          eq(userAuthProviders.provider, EMAIL_PROVIDER_KEY)
        )
      )
      .limit(1);

    const row = rows[0];

    if (!row || row.authProvider.passwordHash === "") {
      throw ApiErrors.validation(
        "Password login is not enabled for this account",
        "currentPassword"
      );
    }

    const isValid = await passwordService.verify(
      currentPassword,
      row.authProvider.passwordHash
    );

    if (!isValid) {
      throw ApiErrors.validation(
        "Current password is incorrect",
        "currentPassword"
      );
    }

    const passwordHash = await passwordService.hash(newPassword);

    await db
      .update(userAuthProviders)
      .set({ passwordHash })
      .where(
        and(
          eq(userAuthProviders.userId, userId),
          eq(userAuthProviders.provider, EMAIL_PROVIDER_KEY)
        )
      );

    /*
     * Force re-auth across every device. `sessionService.revokeAllForUser`
     * deletes the refresh-session rows AND bumps the per-user JWT
     * cutoff in one step, so a pre-change access token can't be used
     * to act as the user even before its 15 min TTL elapses.
     */
    await sessionService.revokeAllForUser(userId);

    void sendTemplate({
      to: row.user.email,
      subject: EMAIL_SUBJECTS.PASSWORD_CHANGED,
      templatePath: TEMPLATE_PATHS.PASSWORD_CHANGED,
      variables: {
        preHeader: "Password change confirmation",
        email: row.user.email,
      },
    }).catch((error: unknown) => {
      logger.error("Failed to send password-changed notification", {
        event: "auth.password_change.notification_email_failed",
        userId: row.user.id,
        error: getErrorMessage(error),
      });
    });

    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_PASSWORD_CHANGED,
    });

    return { message: "Password updated successfully" };
  }
}

export const passwordChangeService = new PasswordChangeService();
