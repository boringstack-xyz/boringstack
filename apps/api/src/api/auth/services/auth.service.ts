import { and, eq } from "drizzle-orm";
import { db } from "../../../clients/postgres";
import {
  emailVerificationTokens,
  userAuthProviders,
  users,
} from "../../../clients/postgres/schema";
import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { AUDIT_ACTIONS, auditLogService } from "../../../lib/audit-log";
import {
  maskEmailForLogging,
  normalizeEmail,
  sendTemplate,
} from "../../../lib/email";
import { ApiErrors, getErrorMessage } from "../../../lib/errors";
import { passwordService } from "../../../lib/password";
import { generateOpaqueToken, hashOpaqueToken } from "../../../lib/tokens";
import {
  EMAIL_PROVIDER_KEY,
  EMAIL_SUBJECTS,
  TEMPLATE_PATHS,
  VERIFICATION_TTL_MS,
} from "../auth.constants";
import type {
  ILoginInput,
  ILoginResult,
  IPendingRegistration,
  IRegisterInput,
} from "../auth.types";
import { toPublicUser } from "../auth.utils";
import { nowMs } from "../../../lib/time/now";

/**
 * Password authentication. Registration writes only the `users` row,
 * the password hash, and the verification token — no account, no
 * membership, no session. The user's personal account is provisioned
 * later by `emailVerificationService.verify`, which is the single
 * convergence point with the OAuth flow.
 *
 * Login throws `EMAIL_NOT_VERIFIED` for pending users with valid
 * credentials so the UI can surface a resend prompt instead of a
 * generic 401.
 */
export class AuthService {
  async register(data: IRegisterInput): Promise<IPendingRegistration> {
    const email = normalizeEmail(data.email);

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      throw ApiErrors.conflict("User already exists");
    }

    const passwordHash = await passwordService.hash(data.password);
    const verificationToken = generateOpaqueToken();
    const expiresAt = new Date(nowMs() + VERIFICATION_TTL_MS).toISOString();

    const created = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email,
          firstName: data.firstName ?? "",
          lastName: data.lastName ?? "",
        })
        .returning();

      if (!user) {
        throw ApiErrors.internal("Failed to create user");
      }

      await tx.insert(userAuthProviders).values({
        userId: user.id,
        provider: EMAIL_PROVIDER_KEY,
        providerUserId: email,
        passwordHash,
      });

      await tx.insert(emailVerificationTokens).values({
        userId: user.id,
        tokenHash: hashOpaqueToken(verificationToken),
        expiresAt,
      });

      return user;
    });

    try {
      await sendTemplate({
        to: created.email,
        subject: EMAIL_SUBJECTS.CONFIRM_EMAIL,
        templatePath: TEMPLATE_PATHS.CONFIRM_EMAIL,
        variables: {
          preHeader: "Click the button below to verify your email",
          token: verificationToken,
          confirmationUrl: `${env.FRONTEND_URL}/verify-email`,
        },
      });
    } catch (error: unknown) {
      logger.error("Failed to send verification email", {
        event: "auth.register.verification_email_failed",
        userId: created.id,
        error: getErrorMessage(error),
      });
    }

    logger.info("User registered", {
      event: "auth.register.success",
      userId: created.id,
      email: maskEmailForLogging(created.email),
    });

    void auditLogService.record({
      userId: created.id,
      action: AUDIT_ACTIONS.AUTH_REGISTER,
    });

    return { email: created.email };
  }

  async login(data: ILoginInput): Promise<ILoginResult> {
    const email = normalizeEmail(data.email);

    const rows = await db
      .select({ user: users, authProvider: userAuthProviders })
      .from(users)
      .innerJoin(userAuthProviders, eq(users.id, userAuthProviders.userId))
      .where(
        and(
          eq(users.email, email),
          eq(userAuthProviders.provider, EMAIL_PROVIDER_KEY)
        )
      )
      .limit(1);

    const row = rows[0];

    if (!row || row.authProvider.passwordHash === "") {
      await passwordService.performDummyVerify();

      throw ApiErrors.invalidCredentials();
    }

    const isValid = await passwordService.verify(
      data.password,
      row.authProvider.passwordHash
    );

    if (!isValid) {
      logger.warn("Invalid password", {
        event: "auth.login.invalid_password",
        userId: row.user.id,
      });

      void auditLogService.record({
        userId: row.user.id,
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      });

      throw ApiErrors.invalidCredentials();
    }

    /*
     * Opportunistic rehash: silently upgrade legacy bcrypt hashes to
     * argon2id on the next successful login. Awaited so a crash mid-flow
     * cannot leave the user authenticated but with a stale hash; the
     * cost is amortised across every login that's already paying a
     * full argon2id verify. Failures are non-fatal — the user is still
     * authenticated, we just retry the upgrade next time.
     */
    if (passwordService.needsRehash(row.authProvider.passwordHash)) {
      try {
        const upgradedHash = await passwordService.hash(data.password);

        await db
          .update(userAuthProviders)
          .set({ passwordHash: upgradedHash })
          .where(
            and(
              eq(userAuthProviders.userId, row.user.id),
              eq(userAuthProviders.provider, EMAIL_PROVIDER_KEY)
            )
          );

        logger.info("Password hash upgraded to argon2id", {
          event: "auth.login.password_rehashed",
          userId: row.user.id,
        });
      } catch (error: unknown) {
        logger.warn("Failed to upgrade legacy password hash", {
          event: "auth.login.password_rehash_failed",
          userId: row.user.id,
          error: getErrorMessage(error),
        });
      }
    }

    /*
     * Password ok but email never verified — surface a distinct error
     * code so the UI can offer a resend-verification CTA. Safe to
     * reveal: the caller already proved they hold the password.
     */
    if (row.user.emailVerifiedAt === null) {
      logger.info("Login blocked: email not verified", {
        event: "auth.login.email_not_verified",
        userId: row.user.id,
      });

      void auditLogService.record({
        userId: row.user.id,
        action: AUDIT_ACTIONS.AUTH_LOGIN_BLOCKED_UNVERIFIED,
      });

      throw ApiErrors.emailNotVerified();
    }

    if (row.user.mfaEnabledAt !== null) {
      logger.info("Login deferred to MFA challenge", {
        event: "auth.login.mfa_required",
        userId: row.user.id,
      });

      void auditLogService.record({
        userId: row.user.id,
        action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
        metadata: { mfaRequired: true },
      });

      return { mfaRequired: true, userId: row.user.id };
    }

    logger.info("User logged in", {
      event: "auth.login.success",
      userId: row.user.id,
    });

    void auditLogService.record({
      userId: row.user.id,
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
    });

    return { mfaRequired: false, user: toPublicUser(row.user) };
  }
}

export const authService = new AuthService();
