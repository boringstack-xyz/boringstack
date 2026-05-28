import { beforeEach, describe, expect, test } from "bun:test";
import { Secret, TOTP } from "otpauth";

import { mfaService } from "../../../../src/api/auth/services/mfa.service";
import {
  MFA_CACHE_KEYS,
  MFA_MAX_CHALLENGE_ATTEMPTS,
  MFA_RECOVERY_CODE_COUNT,
  MFA_TOTP_DIGITS,
  MFA_TOTP_STEP_SECONDS,
} from "../../../../src/api/auth/mfa.constants";
import { cacheService } from "../../../../src/lib/cache";
import { ApiError } from "../../../../src/lib/errors";
import {
  and,
  cleanDatabase,
  db,
  eq,
  isNull,
  mfaRecoveryCodes,
  requireDb,
  users,
} from "../../../helpers/db";
import { seedVerifiedUser } from "../../../helpers/auth";

const PASSWORD = "Hunter2Strong!";

const generateTotpForUser = async (
  userId: string,
  offsetSteps = 0
): Promise<string> => {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });

  if (row === undefined) {
    throw new Error("user row not found");
  }

  if (row.mfaSecretEncrypted === null) {
    throw new Error("user has no MFA secret on row");
  }

  // Decrypt via the same util the service uses
  const { decryptString } = await import("../../../../src/lib/crypto");
  const secretBase32 = decryptString(row.mfaSecretEncrypted);
  const totp = new TOTP({
    issuer: "test",
    label: "test",
    algorithm: "SHA1",
    digits: MFA_TOTP_DIGITS,
    period: MFA_TOTP_STEP_SECONDS,
    secret: Secret.fromBase32(secretBase32),
  });
  const timestamp = Date.now() + offsetSteps * MFA_TOTP_STEP_SECONDS * 1000;

  return totp.generate({ timestamp });
};

const enrollMfa = async (
  userId: string
): Promise<{ recoveryCodes: string[] }> => {
  const setup = await mfaService.setup(userId, PASSWORD);
  /*
   * Pull the staged secret straight from Valkey and generate a real
   * first-code so the e2e flow runs end-to-end.
   */
  const staged = await cacheService.get<{ secretEncrypted: string }>(
    MFA_CACHE_KEYS.setup(userId)
  );

  if (staged === null) {
    throw new Error("setup did not persist a staged secret");
  }

  const { decryptString } = await import("../../../../src/lib/crypto");
  const totp = new TOTP({
    issuer: "test",
    label: "test",
    algorithm: "SHA1",
    digits: MFA_TOTP_DIGITS,
    period: MFA_TOTP_STEP_SECONDS,
    secret: Secret.fromBase32(decryptString(staged.secretEncrypted)),
  });

  await mfaService.verifySetup(userId, totp.generate());

  return { recoveryCodes: setup.recoveryCodes };
};

describe("MfaService", () => {
  beforeEach(async () => {
    if (await requireDb()) {
      await cleanDatabase();
    }
  });

  describe("setup + verifySetup", () => {
    test("happy path persists encrypted secret and recovery codes", async () => {
      if (!(await requireDb())) {
        return;
      }

      const { user } = await seedVerifiedUser({
        email: "mfa-setup@example.com",
        password: PASSWORD,
      });

      const setup = await mfaService.setup(user.id, PASSWORD);

      expect(setup.otpauthUri).toMatch(/^otpauth:\/\/totp\//u);
      expect(setup.recoveryCodes).toHaveLength(MFA_RECOVERY_CODE_COUNT);

      // Plaintext recovery codes are 2 * MFA_RECOVERY_CODE_BYTES hex chars.
      for (const code of setup.recoveryCodes) {
        expect(code).toMatch(/^[0-9a-f]{10}$/u);
      }

      const staged = await cacheService.get<{ secretEncrypted: string }>(
        MFA_CACHE_KEYS.setup(user.id)
      );

      expect(staged).not.toBeNull();

      const { decryptString } = await import("../../../../src/lib/crypto");
      const secretBase32 = decryptString(staged?.secretEncrypted ?? "");
      const totp = new TOTP({
        issuer: "x",
        label: "x",
        algorithm: "SHA1",
        digits: MFA_TOTP_DIGITS,
        period: MFA_TOTP_STEP_SECONDS,
        secret: Secret.fromBase32(secretBase32),
      });

      await mfaService.verifySetup(user.id, totp.generate());

      const row = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });

      expect(row?.mfaEnabledAt).not.toBeNull();
      expect(row?.mfaSecretEncrypted).not.toBeNull();
      expect(row?.mfaLastTotpStep).not.toBeNull();

      const codeRows = await db
        .select()
        .from(mfaRecoveryCodes)
        .where(eq(mfaRecoveryCodes.userId, user.id));

      expect(codeRows).toHaveLength(MFA_RECOVERY_CODE_COUNT);
    });

    test("rejects setup with wrong password", async () => {
      if (!(await requireDb())) {
        return;
      }

      const { user } = await seedVerifiedUser({
        email: "mfa-wrongpw@example.com",
        password: PASSWORD,
      });

      let caught: unknown;

      try {
        await mfaService.setup(user.id, "NotTheRealPassword1!");
      } catch (error: unknown) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ApiError);
    });

    test("rejects verifySetup with a wrong code", async () => {
      if (!(await requireDb())) {
        return;
      }

      const { user } = await seedVerifiedUser({
        email: "mfa-bad-code@example.com",
        password: PASSWORD,
      });

      await mfaService.setup(user.id, PASSWORD);

      let caught: unknown;

      try {
        await mfaService.verifySetup(user.id, "000000");
      } catch (error: unknown) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ApiError);
    });
  });

  describe("verifyTotpLogin", () => {
    test("accepts a current TOTP code and bumps the replay guard", async () => {
      if (!(await requireDb())) {
        return;
      }

      const { user } = await seedVerifiedUser({
        email: "mfa-login@example.com",
        password: PASSWORD,
      });

      await enrollMfa(user.id);
      /*
       * Verifying setup already bumped mfaLastTotpStep to the current
       * step. Clear it so the test isn't blocked by the replay guard
       * when it generates a code in the same 30s window.
       */
      await db
        .update(users)
        .set({ mfaLastTotpStep: null })
        .where(eq(users.id, user.id));

      const { challengeToken } = await mfaService.issueChallenge(user.id);
      const code = await generateTotpForUser(user.id);
      const outcome = await mfaService.verifyTotpLogin(challengeToken, code);

      expect(outcome.kind).toBe("verified");

      const row = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });

      expect(row?.mfaLastTotpStep).not.toBeNull();
    });

    test("rejects replay of the same code in the same step", async () => {
      if (!(await requireDb())) {
        return;
      }

      const { user } = await seedVerifiedUser({
        email: "mfa-replay@example.com",
        password: PASSWORD,
      });

      await enrollMfa(user.id);
      await db
        .update(users)
        .set({ mfaLastTotpStep: null })
        .where(eq(users.id, user.id));

      const first = await mfaService.issueChallenge(user.id);
      const code = await generateTotpForUser(user.id);
      const ok = await mfaService.verifyTotpLogin(first.challengeToken, code);

      expect(ok.kind).toBe("verified");

      const second = await mfaService.issueChallenge(user.id);
      const replay = await mfaService.verifyTotpLogin(
        second.challengeToken,
        code
      );

      expect(replay.kind).toBe("failed");
    });

    test(`locks out after ${String(MFA_MAX_CHALLENGE_ATTEMPTS)} failed attempts`, async () => {
      if (!(await requireDb())) {
        return;
      }

      const { user } = await seedVerifiedUser({
        email: "mfa-lockout@example.com",
        password: PASSWORD,
      });

      await enrollMfa(user.id);

      const { challengeToken } = await mfaService.issueChallenge(user.id);
      let lastOutcome: { kind: string } | null = null;

      for (let index = 0; index < MFA_MAX_CHALLENGE_ATTEMPTS; index += 1) {
        lastOutcome = await mfaService.verifyTotpLogin(
          challengeToken,
          "000000"
        );
      }

      expect(lastOutcome?.kind).toBe("locked_out");

      /*
       * The challenge is now gone — a follow-up call returns 401 from
       * the missing-challenge branch, not "failed".
       */
      let caught: unknown;

      try {
        await mfaService.verifyTotpLogin(challengeToken, "000000");
      } catch (error: unknown) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ApiError);
    });
  });

  describe("verifyRecoveryLogin", () => {
    test("consumes a recovery code exactly once", async () => {
      if (!(await requireDb())) {
        return;
      }

      const { user } = await seedVerifiedUser({
        email: "mfa-recovery@example.com",
        password: PASSWORD,
      });

      const { recoveryCodes } = await enrollMfa(user.id);
      const [code, ...rest] = recoveryCodes;

      if (code === undefined) {
        throw new Error("recovery codes empty");
      }

      const first = await mfaService.issueChallenge(user.id);
      const ok = await mfaService.verifyRecoveryLogin(
        first.challengeToken,
        code
      );

      expect(ok.kind).toBe("verified");

      // Second use of the same code fails. Other codes still work.
      const second = await mfaService.issueChallenge(user.id);
      const replay = await mfaService.verifyRecoveryLogin(
        second.challengeToken,
        code
      );

      expect(replay.kind).toBe("failed");

      const third = await mfaService.issueChallenge(user.id);
      const otherCode = rest[0];

      if (otherCode === undefined) {
        throw new Error("only one recovery code generated");
      }

      const stillGood = await mfaService.verifyRecoveryLogin(
        third.challengeToken,
        otherCode
      );

      expect(stillGood.kind).toBe("verified");

      const unused = await db
        .select()
        .from(mfaRecoveryCodes)
        .where(eq(mfaRecoveryCodes.userId, user.id));
      const usedCount = unused.filter((row) => row.usedAt !== null).length;

      expect(usedCount).toBe(2);
    });
  });

  describe("regenerateRecoveryCodes", () => {
    test("replaces every code and returns plaintext once", async () => {
      if (!(await requireDb())) {
        return;
      }

      const { user } = await seedVerifiedUser({
        email: "mfa-regen@example.com",
        password: PASSWORD,
      });

      const { recoveryCodes: original } = await enrollMfa(user.id);
      const { recoveryCodes: fresh } = await mfaService.regenerateRecoveryCodes(
        user.id,
        PASSWORD
      );

      expect(fresh).toHaveLength(MFA_RECOVERY_CODE_COUNT);

      // None of the original codes survive the regeneration.
      for (const oldCode of original) {
        expect(fresh).not.toContain(oldCode);
      }

      const rowsAfter = await db
        .select()
        .from(mfaRecoveryCodes)
        .where(eq(mfaRecoveryCodes.userId, user.id));

      expect(rowsAfter).toHaveLength(MFA_RECOVERY_CODE_COUNT);
      expect(rowsAfter.every((row) => row.usedAt === null)).toBe(true);
    });
  });

  describe("disable", () => {
    test("clears state and drops every recovery code", async () => {
      if (!(await requireDb())) {
        return;
      }

      const { user } = await seedVerifiedUser({
        email: "mfa-disable@example.com",
        password: PASSWORD,
      });

      await enrollMfa(user.id);
      await mfaService.disable(user.id, PASSWORD);

      const row = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });

      expect(row?.mfaEnabledAt).toBeNull();
      expect(row?.mfaSecretEncrypted).toBeNull();
      expect(row?.mfaLastTotpStep).toBeNull();

      const remaining = await db
        .select()
        .from(mfaRecoveryCodes)
        .where(
          and(
            eq(mfaRecoveryCodes.userId, user.id),
            isNull(mfaRecoveryCodes.usedAt)
          )
        );

      expect(remaining).toHaveLength(0);
    });

    test("rejects disable with wrong password", async () => {
      if (!(await requireDb())) {
        return;
      }

      const { user } = await seedVerifiedUser({
        email: "mfa-disable-bad@example.com",
        password: PASSWORD,
      });

      await enrollMfa(user.id);

      let caught: unknown;

      try {
        await mfaService.disable(user.id, "NotTheRealPassword1!");
      } catch (error: unknown) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ApiError);
    });
  });
});
