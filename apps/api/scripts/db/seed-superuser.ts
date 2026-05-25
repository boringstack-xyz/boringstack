#!/usr/bin/env bun
import { now } from "../../src/lib/time/now";
/**
 * Optional first-boot superuser bootstrap. Reads SUPERUSER_EMAIL and
 * SUPERUSER_PASSWORD from the environment; if both are set, creates a user
 * with the `admin` role and an email-password credential. Idempotent: if
 * the user already exists, the script is a no-op.
 *
 *   bun run scripts/db/seed-superuser.ts
 *
 * Empty env = no user created. Sign up via the registration flow, or set
 * the env vars and re-run.
 *
 * To rotate the password later, do it through the application's
 * password-reset flow, not this script.
 *
 * Schema note: passwords live in `auth.user_auth_providers` (one row per
 * provider — "email", "google", etc.), not on the user record itself.
 */
import { eq } from "drizzle-orm";

import { accountsService } from "../../src/api/accounts";
import { EMAIL_PROVIDER_KEY } from "../../src/api/auth/auth.constants";
import { db } from "../../src/clients/postgres";
import { userAuthProviders, users } from "../../src/clients/postgres/schema";
import { env } from "../../src/config/env";
import { passwordService } from "../../src/lib/password";

async function main(): Promise<void> {
  const email = env.SUPERUSER_EMAIL.trim();
  const password = env.SUPERUSER_PASSWORD;

  if (email === "" || password === "") {
    console.log(
      "[seed-superuser] SUPERUSER_EMAIL or SUPERUSER_PASSWORD unset — skipping. " +
        "Set both to create a privileged user on first migrate, or sign up via the UI. " +
        "Running under docker-compose? The api-migrate service interpolates these " +
        "from compose/.env (NOT api-template/.env)."
    );

    return;
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing !== undefined) {
    console.log(
      `[seed-superuser] user ${email} already exists — skipping. ` +
        "Rotate via the password-reset flow if needed."
    );

    return;
  }

  const passwordHash = await passwordService.hash(password);
  const nowIso = now();

  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email,
        firstName: "Admin",
        lastName: "",
        emailVerifiedAt: nowIso,
        isPlatformAdmin: true,
      })
      .returning();

    if (!user) {
      throw new Error("Failed to insert superuser");
    }

    await tx.insert(userAuthProviders).values({
      userId: user.id,
      provider: EMAIL_PROVIDER_KEY,
      providerUserId: email,
      passwordHash,
    });

    /*
     * Login resolves `aid` from the user's first active membership,
     * so the seed reaches the same convergence point a real verify-
     * email click would. Passing `tx` keeps the whole bootstrap
     * (user + provider + account + membership) in one transaction.
     */
    await accountsService.provisionAfterVerification({ userId: user.id }, tx);
  });

  console.log(`[seed-superuser] created superuser ${email} with role=admin`);
}

main()
  .catch((error: unknown) => {
    console.error("[seed-superuser] failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
