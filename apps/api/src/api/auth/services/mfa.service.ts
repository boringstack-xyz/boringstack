import { and, eq, isNull, lt, or } from "drizzle-orm";
import { Secret } from "otpauth";

import { db } from "../../../clients/postgres";
import {
  mfaRecoveryCodes,
  userAuthProviders,
  users,
} from "../../../clients/postgres/schema";
import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { AUDIT_ACTIONS, auditLogService } from "../../../lib/audit-log";
import { cacheService } from "../../../lib/cache";
import { decryptString, encryptString } from "../../../lib/crypto";
import { sendTemplate } from "../../../lib/email";
import { ApiErrors, getErrorMessage } from "../../../lib/errors";
import { passwordService } from "../../../lib/password";
import { now } from "../../../lib/time/now";
import { generateOpaqueToken, hashOpaqueToken } from "../../../lib/tokens";
import { EMAIL_PROVIDER_KEY } from "../auth.constants";
import { toPublicUser } from "../auth.utils";
import {
  MFA_CACHE_KEYS,
  MFA_CHALLENGE_TTL_SECONDS,
  MFA_EMAIL_SUBJECTS,
  MFA_MAX_CHALLENGE_ATTEMPTS,
  MFA_SETUP_TTL_SECONDS,
  MFA_TEMPLATE_PATHS,
  MFA_TOTP_WINDOW,
} from "../mfa.constants";
import type {
  IMfaChallenge,
  IMfaChallengeCachePayload,
  IMfaRecoveryRegenerationResult,
  IMfaSetupCachePayload,
  IMfaSetupResult,
  IMfaVerifyOutcome,
} from "../mfa.types";
import { buildTotp, currentTotpStep, generateRecoveryCodes } from "./mfa.utils";

/**
 * TOTP MFA. Optional per-user second factor on top of password login.
 * Mid-enrollment state (the staged secret + provisional recovery codes)
 * lives in Valkey under `MFA_CACHE_KEYS.setup`; the durable bits move to
 * Postgres only once the user proves they can read a code from the
 * shared secret. Login challenge tokens are opaque, single-use, hashed
 * before persistence, and self-destruct after `MFA_MAX_CHALLENGE_ATTEMPTS`.
 */
export class MfaService {
  /**
   * Begin enrollment. Requires the user's current password as step-up
   * auth so a stolen session cannot silently enrol a new device. The
   * generated secret is encrypted at rest in Valkey; the route forwards
   * the otpauth URI + plaintext recovery codes to the SPA for display.
   *
   * Calling `setup` twice replaces the prior staged secret.
   */
  async setup(userId: string, password: string): Promise<IMfaSetupResult> {
    const user = await this.assertPasswordValid(userId, password);

    if (user.mfaEnabledAt !== null) {
      throw ApiErrors.conflict(
        "MFA is already enabled. Disable it before enrolling a new device."
      );
    }

    const secret = new Secret({ size: 32 });
    const totp = buildTotp(secret.base32, user.email);
    const recoveryCodes = generateRecoveryCodes();
    const recoveryCodeHashes = await Promise.all(
      recoveryCodes.map((code) => passwordService.hash(code))
    );
    const cachePayload: IMfaSetupCachePayload = {
      secretEncrypted: encryptString(secret.base32),
      recoveryCodeHashes,
    };

    await cacheService.set(MFA_CACHE_KEYS.setup(userId), cachePayload, {
      ttlSeconds: MFA_SETUP_TTL_SECONDS,
    });

    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_MFA_SETUP_INITIATED,
    });

    logger.info("MFA setup initiated", {
      event: "auth.mfa.setup_initiated",
      userId,
    });

    return {
      otpauthUri: totp.toString(),
      secretBase32: secret.base32,
      recoveryCodes,
    };
  }

  /**
   * Complete enrollment. Validates the first TOTP code against the
   * staged secret, persists the encrypted secret + hashed recovery codes
   * to Postgres, marks the user as MFA-enabled, and fires the
   * "MFA enabled" notification email.
   */
  async verifySetup(userId: string, code: string): Promise<void> {
    const staged = await cacheService.get<IMfaSetupCachePayload>(
      MFA_CACHE_KEYS.setup(userId)
    );

    if (staged === null) {
      throw ApiErrors.invalidInput(
        "Enrollment session expired. Start setup again."
      );
    }

    const secretBase32 = decryptString(staged.secretEncrypted);
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (user === undefined) {
      throw ApiErrors.notFound("User");
    }

    const totp = buildTotp(secretBase32, user.email);
    const delta = totp.validate({ token: code, window: MFA_TOTP_WINDOW });

    if (delta === null) {
      throw ApiErrors.invalidInput("Invalid verification code");
    }

    const matchedStep = currentTotpStep() + delta;
    const enabledAt = now();

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          mfaEnabledAt: enabledAt,
          mfaSecretEncrypted: staged.secretEncrypted,
          mfaLastTotpStep: matchedStep,
          updatedAt: enabledAt,
        })
        .where(eq(users.id, userId));

      await tx
        .delete(mfaRecoveryCodes)
        .where(eq(mfaRecoveryCodes.userId, userId));

      await tx.insert(mfaRecoveryCodes).values(
        staged.recoveryCodeHashes.map((codeHash) => ({
          userId,
          codeHash,
        }))
      );
    });

    await cacheService.del(MFA_CACHE_KEYS.setup(userId));

    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_MFA_ENABLED,
    });

    this.sendLifecycleEmail(user.email, "enabled");

    logger.info("MFA enabled", {
      event: "auth.mfa.enabled",
      userId,
    });
  }

  /**
   * Issue an opaque challenge token. Stored in Valkey under the HMAC
   * hash of the token (never the raw value), TTL
   * `MFA_CHALLENGE_TTL_SECONDS`. The SPA exchanges this for the
   * authenticated session via `/auth/mfa/verify-login` (or
   * `/auth/mfa/verify-recovery`).
   */
  async issueChallenge(userId: string): Promise<IMfaChallenge> {
    const challengeToken = generateOpaqueToken();
    const payload: IMfaChallengeCachePayload = { userId };

    await cacheService.set(
      MFA_CACHE_KEYS.challenge(hashOpaqueToken(challengeToken)),
      payload,
      { ttlSeconds: MFA_CHALLENGE_TTL_SECONDS }
    );

    return { challengeToken };
  }

  async verifyTotpLogin(
    challengeToken: string,
    code: string
  ): Promise<IMfaVerifyOutcome> {
    const tokenHash = hashOpaqueToken(challengeToken);
    const challengeKey = MFA_CACHE_KEYS.challenge(tokenHash);
    const attemptsKey = MFA_CACHE_KEYS.challengeAttempts(tokenHash);
    const challenge =
      await cacheService.get<IMfaChallengeCachePayload>(challengeKey);

    if (challenge === null) {
      throw ApiErrors.unauthorized("MFA challenge has expired. Sign in again.");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, challenge.userId),
    });

    if (user === undefined) {
      throw ApiErrors.unauthorized("MFA challenge target missing");
    }

    if (user.mfaEnabledAt === null || user.mfaSecretEncrypted === null) {
      throw ApiErrors.unauthorized("MFA is not configured");
    }

    /*
     * Spend the guess first. Everything below evaluates the submitted code,
     * so admission has to be decided before it runs.
     */
    const reservation = await this.reserveAttempt(challengeKey, attemptsKey);

    if (!reservation.granted) {
      return this.lockedOut(user.id);
    }

    const secretBase32 = decryptString(user.mfaSecretEncrypted);
    const totp = buildTotp(secretBase32, user.email);
    const delta = totp.validate({ token: code, window: MFA_TOTP_WINDOW });

    if (delta === null) {
      return this.recordFailedAttempt(challengeKey, user.id, reservation.spent);
    }

    const matchedStep = currentTotpStep() + delta;
    const lastStep = user.mfaLastTotpStep;

    if (lastStep !== null && matchedStep <= lastStep) {
      logger.warn("MFA TOTP replay rejected", {
        event: "auth.mfa.totp_replay_rejected",
        userId: user.id,
      });

      return this.recordFailedAttempt(challengeKey, user.id, reservation.spent);
    }

    /*
     * Atomic consume. Two concurrent verifies with the same valid TOTP
     * code would otherwise both clear the in-memory replay check and
     * both UPDATE, issuing two sessions from one factor. The
     * conditional WHERE clause ensures only one transaction commits;
     * the loser returns `failed` without touching the challenge so it
     * does not resurrect a key the winner is about to delete.
     */
    const claimed = await db
      .update(users)
      .set({ mfaLastTotpStep: matchedStep, updatedAt: now() })
      .where(
        and(
          eq(users.id, user.id),
          or(
            isNull(users.mfaLastTotpStep),
            lt(users.mfaLastTotpStep, matchedStep)
          )
        )
      )
      .returning({ id: users.id });

    if (claimed.length === 0) {
      logger.warn("MFA TOTP race lost", {
        event: "auth.mfa.totp_replay_rejected",
        userId: user.id,
      });

      return { kind: "failed", attemptsRemaining: 0 };
    }

    await cacheService.del([challengeKey, attemptsKey]);

    void auditLogService.record({
      userId: user.id,
      action: AUDIT_ACTIONS.AUTH_MFA_LOGIN_SUCCESS,
    });

    logger.info("MFA login success", {
      event: "auth.mfa.login_success",
      userId: user.id,
    });

    return { kind: "verified", user: toPublicUser(user) };
  }

  async verifyRecoveryLogin(
    challengeToken: string,
    code: string
  ): Promise<IMfaVerifyOutcome> {
    const tokenHash = hashOpaqueToken(challengeToken);
    const challengeKey = MFA_CACHE_KEYS.challenge(tokenHash);
    const attemptsKey = MFA_CACHE_KEYS.challengeAttempts(tokenHash);
    const challenge =
      await cacheService.get<IMfaChallengeCachePayload>(challengeKey);

    if (challenge === null) {
      throw ApiErrors.unauthorized("MFA challenge has expired. Sign in again.");
    }

    /*
     * Same rule as the TOTP path: the guess is spent before the code is
     * compared against anything.
     */
    const reservation = await this.reserveAttempt(challengeKey, attemptsKey);

    if (!reservation.granted) {
      return this.lockedOut(challenge.userId);
    }

    const rows = await db
      .select()
      .from(mfaRecoveryCodes)
      .where(
        and(
          eq(mfaRecoveryCodes.userId, challenge.userId),
          isNull(mfaRecoveryCodes.usedAt)
        )
      );

    let matched: { id: number } | null = null;

    for (const row of rows) {
      if (await passwordService.verify(code, row.codeHash)) {
        matched = { id: row.id };

        break;
      }
    }

    if (matched === null) {
      /*
       * Flatten timing on the no-match path the same way the login path
       * does (auth.service.ts performDummyVerify). The hashes are random
       * high-entropy codes so enumeration isn't practical, but matching
       * login's constant-time treatment keeps credential paths consistent
       * and avoids leaking how many unused codes remain via latency.
       */
      await passwordService.performDummyVerify();

      return this.recordFailedAttempt(
        challengeKey,
        challenge.userId,
        reservation.spent
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, challenge.userId),
    });

    if (user === undefined) {
      throw ApiErrors.unauthorized("MFA challenge target missing");
    }

    /*
     * Atomic consume. The argon2id verify above is slow (~20-50ms),
     * which is a wide window for two concurrent requests with the
     * same valid code to both clear the in-memory check. The
     * conditional `used_at IS NULL` clause + RETURNING make sure only
     * one transaction commits; the loser returns failed without
     * touching the challenge so it does not resurrect a key the
     * winner is about to delete.
     */
    const claimed = await db
      .update(mfaRecoveryCodes)
      .set({ usedAt: now() })
      .where(
        and(
          eq(mfaRecoveryCodes.id, matched.id),
          isNull(mfaRecoveryCodes.usedAt)
        )
      )
      .returning({ id: mfaRecoveryCodes.id });

    if (claimed.length === 0) {
      logger.warn("MFA recovery code race lost", {
        event: "auth.mfa.recovery_used",
        userId: challenge.userId,
      });

      return { kind: "failed", attemptsRemaining: 0 };
    }

    await cacheService.del([challengeKey, attemptsKey]);

    void auditLogService.record({
      userId: challenge.userId,
      action: AUDIT_ACTIONS.AUTH_MFA_RECOVERY_USED,
    });

    logger.warn("MFA recovery code consumed", {
      event: "auth.mfa.recovery_used",
      userId: challenge.userId,
    });

    return { kind: "verified", user: toPublicUser(user) };
  }

  /**
   * Replace every recovery code with a freshly generated set. Step-up
   * auth via the current password; returns plaintext exactly once.
   */
  async regenerateRecoveryCodes(
    userId: string,
    password: string
  ): Promise<IMfaRecoveryRegenerationResult> {
    const user = await this.assertPasswordValid(userId, password);

    if (user.mfaEnabledAt === null) {
      throw ApiErrors.conflict("MFA is not enabled");
    }

    const recoveryCodes = generateRecoveryCodes();
    const recoveryCodeHashes = await Promise.all(
      recoveryCodes.map((code) => passwordService.hash(code))
    );

    await db.transaction(async (tx) => {
      await tx
        .delete(mfaRecoveryCodes)
        .where(eq(mfaRecoveryCodes.userId, userId));

      await tx.insert(mfaRecoveryCodes).values(
        recoveryCodeHashes.map((codeHash) => ({
          userId,
          codeHash,
        }))
      );
    });

    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_MFA_RECOVERY_CODES_REGENERATED,
    });

    return { recoveryCodes };
  }

  /**
   * Turn MFA off. Step-up auth via the current password; clears every
   * MFA artifact (secret, last step, recovery codes) and fires the
   * "MFA disabled" notification email so a stolen session can't quietly
   * remove the second factor without the legitimate user noticing.
   */
  async disable(userId: string, password: string): Promise<void> {
    const user = await this.assertPasswordValid(userId, password);

    if (user.mfaEnabledAt === null) {
      throw ApiErrors.conflict("MFA is not enabled");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          mfaEnabledAt: null,
          mfaSecretEncrypted: null,
          mfaLastTotpStep: null,
          updatedAt: now(),
        })
        .where(eq(users.id, userId));

      await tx
        .delete(mfaRecoveryCodes)
        .where(eq(mfaRecoveryCodes.userId, userId));
    });

    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_MFA_DISABLED,
    });

    this.sendLifecycleEmail(user.email, "disabled");

    logger.info("MFA disabled", {
      event: "auth.mfa.disabled",
      userId,
    });
  }

  /**
   * Step-up auth shared across `setup`, `regenerateRecoveryCodes`, and
   * `disable`. Throws `unauthorized` on bad password; returns the user
   * row on success so callers don't re-query.
   */
  private async assertPasswordValid(
    userId: string,
    password: string
  ): Promise<typeof users.$inferSelect> {
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

    if (row === undefined || row.authProvider.passwordHash === "") {
      throw ApiErrors.unauthorized(
        "Password re-authentication is required for this action."
      );
    }

    const valid = await passwordService.verify(
      password,
      row.authProvider.passwordHash
    );

    if (!valid) {
      throw ApiErrors.unauthorized("Incorrect password");
    }

    return row.user;
  }

  /**
   * Claims one guess against the challenge budget BEFORE the factor is
   * evaluated.
   *
   * Charging only on failure does not bound anything: every request that has
   * already read the challenge goes on to evaluate its code, so a burst of
   * eight submissions runs the validator eight times against a budget of
   * five, and a correct code among the surplus takes the success path
   * without ever consulting the counter. The budget has to be spent to enter
   * the door, not to leave it.
   *
   * The counter is a dedicated key driven by an atomic increment, never a
   * field re-written from a payload read earlier in the request: concurrent
   * submissions would all read the same value and all write back value+1.
   *
   * The challenge TTL is NOT renewed here. Re-setting it on every attempt
   * lets a slow trickle of guesses hold a challenge open indefinitely,
   * instead of it expiring five minutes after issue.
   */
  private async reserveAttempt(
    challengeKey: string,
    attemptsKey: string
  ): Promise<{ granted: boolean; spent: number }> {
    const spent = await cacheService.increment(
      attemptsKey,
      MFA_CHALLENGE_TTL_SECONDS
    );

    if (spent <= MFA_MAX_CHALLENGE_ATTEMPTS) {
      return { granted: true, spent };
    }

    /*
     * The challenge goes; the counter stays until its own TTL expires.
     * Deleting the counter here would reopen the budget: submissions
     * already in flight read the challenge before it vanished, and their
     * increments would start again from 1, handing a burst a second full
     * budget.
     */
    await cacheService.del(challengeKey);

    return { granted: false, spent };
  }

  /** Records a spent-but-wrong guess. The attempt is already charged. */
  private async recordFailedAttempt(
    challengeKey: string,
    userId: string,
    spent: number
  ): Promise<IMfaVerifyOutcome> {
    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_MFA_LOGIN_FAILED,
      metadata: { attempts: spent },
    });

    if (spent >= MFA_MAX_CHALLENGE_ATTEMPTS) {
      await cacheService.del(challengeKey);

      void auditLogService.record({
        userId,
        action: AUDIT_ACTIONS.AUTH_MFA_LOGIN_LOCKED_OUT,
      });

      logger.warn("MFA challenge locked out", {
        event: "auth.mfa.challenge_locked_out",
        userId,
      });

      return { kind: "locked_out" };
    }

    return {
      kind: "failed",
      attemptsRemaining: MFA_MAX_CHALLENGE_ATTEMPTS - spent,
    };
  }

  /** Refuses a submission that arrived with the budget already spent. */
  private lockedOut(userId: string): IMfaVerifyOutcome {
    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_MFA_LOGIN_LOCKED_OUT,
    });

    logger.warn("MFA challenge locked out", {
      event: "auth.mfa.challenge_locked_out",
      userId,
    });

    return { kind: "locked_out" };
  }

  private sendLifecycleEmail(
    recipientEmail: string,
    state: "enabled" | "disabled"
  ): void {
    const isEnabled = state === "enabled";
    const subject = isEnabled
      ? MFA_EMAIL_SUBJECTS.ENABLED
      : MFA_EMAIL_SUBJECTS.DISABLED;
    const templatePath = isEnabled
      ? MFA_TEMPLATE_PATHS.ENABLED
      : MFA_TEMPLATE_PATHS.DISABLED;

    void sendTemplate({
      to: recipientEmail,
      subject,
      templatePath,
      variables: {
        preHeader: subject,
        email: recipientEmail,
        securityUrl: `${env.FRONTEND_URL}/account/settings`,
      },
    }).catch((error: unknown) => {
      logger.error("MFA lifecycle email dispatch failed", {
        event: `auth.mfa.${state}_email_failed`,
        error: getErrorMessage(error),
      });
    });
  }
}

export const mfaService = new MfaService();
