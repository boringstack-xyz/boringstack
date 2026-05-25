import { beforeEach, describe, expect, test } from "bun:test";

import { oauthAuthService } from "../../../../src/api/auth/services/oauth.service";
import { ApiError } from "../../../../src/lib/errors";
import type { IOAuthProfile } from "../../../../src/lib/oauth";
import { seedPendingUser, seedVerifiedUser } from "../../../helpers/auth";
import {
  accountMemberships,
  accounts,
  cleanDatabase,
  db,
  eq,
  requireDb,
  userAuthProviders,
  users,
} from "../../../helpers/db";

const profile = (overrides: Partial<IOAuthProfile> = {}): IOAuthProfile => ({
  providerUserId: "google-12345",
  email: "oauth@example.com",
  emailVerified: true,
  firstName: "OAuth",
  lastName: "User",
  ...overrides,
});

describe("OAuthAuthService.loginOrRegisterFromProfile", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("creates a new user + provider link + account + owner membership when the email is unseen and verified by the IdP", async () => {
    if (!(await requireDb())) {
      return;
    }

    const result = await oauthAuthService.loginOrRegisterFromProfile(
      "google",
      profile()
    );

    expect(result.isNew).toBe(true);
    expect(result.user.email).toBe("oauth@example.com");
    expect(result.user.emailVerified).toBe(true);
    expect(typeof result.accountId).toBe("string");

    const links = await db
      .select()
      .from(userAuthProviders)
      .where(eq(userAuthProviders.userId, result.user.id));

    expect(links).toHaveLength(1);
    expect(links[0]?.provider).toBe("google");
    expect(links[0]?.providerUserId).toBe("google-12345");

    const accountRows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, result.accountId));

    expect(accountRows).toHaveLength(1);

    const memberships = await db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.userId, result.user.id));

    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe("owner");
  });

  test("returns the existing user (no new link, no duplicate account) on a repeat OAuth login from the same provider", async () => {
    if (!(await requireDb())) {
      return;
    }

    const first = await oauthAuthService.loginOrRegisterFromProfile(
      "google",
      profile()
    );
    const second = await oauthAuthService.loginOrRegisterFromProfile(
      "google",
      profile()
    );

    expect(second.isNew).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(second.accountId).toBe(first.accountId);

    const links = await db
      .select()
      .from(userAuthProviders)
      .where(eq(userAuthProviders.userId, first.user.id));

    expect(links).toHaveLength(1);

    const accountRows = await db.select().from(accounts);

    expect(accountRows).toHaveLength(1);
  });

  test("upgrades a pending password-signup via OAuth: promotes emailVerifiedAt, links provider, AND provisions account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user: existing } = await seedPendingUser({
      email: "linkme@example.com",
      firstName: "Link",
      lastName: "Me",
    });

    expect(existing.emailVerifiedAt).toBeNull();

    const result = await oauthAuthService.loginOrRegisterFromProfile(
      "google",
      profile({ email: "linkme@example.com", emailVerified: true })
    );

    expect(result.isNew).toBe(false);
    expect(result.user.id).toBe(existing.id);
    expect(result.user.emailVerified).toBe(true);

    const allUsersWithEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, "linkme@example.com"));

    expect(allUsersWithEmail).toHaveLength(1);

    const links = await db
      .select()
      .from(userAuthProviders)
      .where(eq(userAuthProviders.userId, existing.id));

    expect(links.map((link) => link.provider).sort()).toEqual([
      "email",
      "google",
    ]);

    const memberships = await db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.userId, existing.id));

    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe("owner");
  });

  test("re-links + provisions for an existing verified password user", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user: existing, account } = await seedVerifiedUser({
      email: "already-verified@example.com",
    });

    const result = await oauthAuthService.loginOrRegisterFromProfile(
      "github",
      profile({
        providerUserId: "gh-1",
        email: "already-verified@example.com",
        emailVerified: false,
      })
    );

    expect(result.user.id).toBe(existing.id);
    expect(result.accountId).toBe(account.id);

    const accountRows = await db.select().from(accounts);

    expect(accountRows).toHaveLength(1);
  });

  test("refuses to issue a session when the IdP says NOT verified and the user wasn't verified yet — throws EMAIL_NOT_VERIFIED, rolls back link", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user: existing } = await seedPendingUser({
      email: "shadow@example.com",
    });

    let caught: unknown;

    try {
      await oauthAuthService.loginOrRegisterFromProfile(
        "github",
        profile({
          providerUserId: "gh-99",
          email: "shadow@example.com",
          emailVerified: false,
        })
      );
    } catch (err: unknown) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.code).toBe("EMAIL_NOT_VERIFIED");
    }

    const refreshed = await db.query.users.findFirst({
      where: eq(users.id, existing.id),
    });

    expect(refreshed?.emailVerifiedAt).toBeNull();

    const links = await db
      .select()
      .from(userAuthProviders)
      .where(eq(userAuthProviders.userId, existing.id));

    expect(links.map((link) => link.provider).sort()).toEqual(["email"]);

    const accountRows = await db.select().from(accounts);

    expect(accountRows).toHaveLength(0);
  });

  test("recovers when an orphan provider link exists (user was deleted): drops the link and creates a fresh account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const first = await oauthAuthService.loginOrRegisterFromProfile(
      "google",
      profile({ providerUserId: "orphan-1" })
    );

    await db.delete(users).where(eq(users.id, first.user.id));

    const second = await oauthAuthService.loginOrRegisterFromProfile(
      "google",
      profile({ providerUserId: "orphan-1" })
    );

    expect(second.isNew).toBe(true);
    expect(second.user.id).not.toBe(first.user.id);
    expect(typeof second.accountId).toBe("string");

    const links = await db
      .select()
      .from(userAuthProviders)
      .where(eq(userAuthProviders.providerUserId, "orphan-1"));

    expect(links).toHaveLength(1);
    expect(links[0]?.userId).toBe(second.user.id);
  });

  test("normalizes the email (lowercases before comparison)", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedVerifiedUser({
      email: "case@example.com",
    });

    const result = await oauthAuthService.loginOrRegisterFromProfile(
      "google",
      profile({ email: "CASE@Example.com" })
    );

    expect(result.isNew).toBe(false);

    const allUsersWithEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, "case@example.com"));

    expect(allUsersWithEmail).toHaveLength(1);
  });
});
