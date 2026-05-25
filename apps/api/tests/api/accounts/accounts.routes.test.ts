import { beforeEach, describe, expect, test } from "bun:test";

import { invitationsService } from "../../../src/api/accounts/invitations.service";
import { createApp } from "../../../src/config/app";
import { AUTH_COOKIE_NAME } from "../../../src/lib/cookies";
import { seedVerifiedUser } from "../../helpers/auth";
import {
  accountMemberships,
  and,
  cleanDatabase,
  db,
  eq,
  isNull,
  requireDb,
} from "../../helpers/db";

const findCookieValue = (
  setCookies: readonly string[] | null,
  name: string
): string => {
  if (setCookies === null) {
    return "";
  }

  for (const raw of setCookies) {
    if (!raw.startsWith(`${name}=`)) {
      continue;
    }

    const semi = raw.indexOf(";");

    return semi === -1 ? raw : raw.slice(0, semi);
  }

  return "";
};

const loginCookie = async (
  app: ReturnType<typeof createApp>,
  email: string,
  password: string
): Promise<string> => {
  const res = await app.handle(
    new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  );

  const cookie = findCookieValue(res.headers.getSetCookie(), AUTH_COOKIE_NAME);

  if (cookie === "") {
    throw new Error(
      `login did not set auth_token (status=${String(res.status)})`
    );
  }

  return cookie;
};

const HTTP_UNAUTHORIZED = 401;
const TEST_UNAUTHORIZED_NO_COOKIE = "401 without an auth cookie";
const uniqueEmail = (prefix: string): string =>
  `${prefix}-${crypto.randomUUID()}@example.com`;

const demoteToMember = async (
  userId: string,
  accountId: string
): Promise<void> => {
  await db
    .update(accountMemberships)
    .set({ role: "member" })
    .where(
      and(
        eq(accountMemberships.userId, userId),
        eq(accountMemberships.accountId, accountId),
        isNull(accountMemberships.revokedAt)
      )
    );
};

describe("POST /api/v1/accounts/switch", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test(TEST_UNAUTHORIZED_NO_COOKIE, async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/accounts/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: "00000000-0000-0000-0000-000000000000",
        }),
      })
    );

    expect(res.status).toBe(HTTP_UNAUTHORIZED);
  });

  test("403 when switching to an account the caller does not belong to", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { password } = await seedVerifiedUser({
      email: "switch@example.com",
    });
    const { account: foreignAccount } = await seedVerifiedUser({
      email: "stranger@example.com",
    });

    const app = createApp();
    const cookie = await loginCookie(app, "switch@example.com", password);

    const res = await app.handle(
      new Request("http://localhost/api/v1/accounts/switch", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ accountId: foreignAccount.id }),
      })
    );

    expect(res.status).toBe(403);
  });

  test("rejects a malformed accountId (TypeBox validation)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { password } = await seedVerifiedUser({
      email: "switch-bad@example.com",
    });
    const app = createApp();
    const cookie = await loginCookie(app, "switch-bad@example.com", password);

    const res = await app.handle(
      new Request("http://localhost/api/v1/accounts/switch", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ accountId: "not-a-uuid" }),
      })
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe("GET /api/v1/accounts/:id/invitations", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test(TEST_UNAUTHORIZED_NO_COOKIE, async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request(
        "http://localhost/api/v1/accounts/00000000-0000-0000-0000-000000000000/invitations"
      )
    );

    expect(res.status).toBe(HTTP_UNAUTHORIZED);
  });

  test("403 when listing invitations for a foreign account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { password } = await seedVerifiedUser({
      email: "lister@example.com",
    });
    const { account: foreign } = await seedVerifiedUser({
      email: "other@example.com",
    });

    const app = createApp();
    const cookie = await loginCookie(app, "lister@example.com", password);

    const res = await app.handle(
      new Request(
        `http://localhost/api/v1/accounts/${foreign.id}/invitations`,
        { headers: { cookie } }
      )
    );

    expect(res.status).toBe(403);
  });

  test("200 + empty array for the owner of an account with no pending invites", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, password } = await seedVerifiedUser({
      email: "owner-list@example.com",
    });
    const app = createApp();
    const cookie = await loginCookie(app, "owner-list@example.com", password);

    const res = await app.handle(
      new Request(
        `http://localhost/api/v1/accounts/${account.id}/invitations`,
        { headers: { cookie } }
      )
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });
});

describe("POST /api/v1/accounts/:id/invitations", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("403 when the caller has been demoted from owner to member", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, user, password } = await seedVerifiedUser({
      email: "demoted@example.com",
    });

    await demoteToMember(user.id, account.id);

    const app = createApp();
    const cookie = await loginCookie(app, "demoted@example.com", password);

    const res = await app.handle(
      new Request(
        `http://localhost/api/v1/accounts/${account.id}/invitations`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({
            email: "new-teammate@example.com",
            roleToAssign: "member",
          }),
        }
      )
    );

    expect(res.status).toBe(403);
  });

  test("200 + rawToken when the owner creates an invitation", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, password } = await seedVerifiedUser({
      email: "owner-invite@example.com",
    });
    const app = createApp();
    const cookie = await loginCookie(app, "owner-invite@example.com", password);

    const res = await app.handle(
      new Request(
        `http://localhost/api/v1/accounts/${account.id}/invitations`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({
            email: "new-teammate@example.com",
            roleToAssign: "member",
          }),
        }
      )
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (
      body === null ||
      typeof body !== "object" ||
      !("rawToken" in body) ||
      !("email" in body) ||
      typeof body.rawToken !== "string" ||
      typeof body.email !== "string"
    ) {
      throw new Error("invitation response missing rawToken/email");
    }

    expect(body.rawToken.length).toBeGreaterThan(16);
    expect(body.email).toBe("new-teammate@example.com");
  });

  test("4th invitation create for the same email is rate-limited", async () => {
    if (!(await requireDb())) {
      return;
    }

    const inviteeEmail = uniqueEmail("invite-target-rate-limit");
    const owners = await Promise.all(
      [1, 2, 3, 4].map((index) =>
        seedVerifiedUser({
          email: uniqueEmail(`invite-owner-rate-limit-${String(index)}`),
        })
      )
    );

    const app = createApp();
    const cookies = await Promise.all(
      owners.map((owner) => loginCookie(app, owner.user.email, owner.password))
    );

    const [owner1, owner2, owner3, owner4] = owners;
    const [cookie1, cookie2, cookie3, cookie4] = cookies;

    if (
      owner1 === undefined ||
      owner2 === undefined ||
      owner3 === undefined ||
      owner4 === undefined ||
      cookie1 === undefined ||
      cookie2 === undefined ||
      cookie3 === undefined ||
      cookie4 === undefined
    ) {
      throw new Error("expected four seeded owners with auth cookies");
    }

    const make = (accountId: string, cookie: string) =>
      app.handle(
        new Request(
          `http://localhost/api/v1/accounts/${accountId}/invitations`,
          {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({
              email: inviteeEmail,
              roleToAssign: "member",
            }),
          }
        )
      );

    const first = await make(owner1.account.id, cookie1);
    const second = await make(owner2.account.id, cookie2);
    const third = await make(owner3.account.id, cookie3);
    const fourth = await make(owner4.account.id, cookie4);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    expect(fourth.status).toBe(400);

    const fourthBody: unknown = await fourth.json();

    expect(JSON.stringify(fourthBody)).toContain("Too many");
  });
});

describe("DELETE /api/v1/accounts/:id", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test(TEST_UNAUTHORIZED_NO_COOKIE, async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request(
        "http://localhost/api/v1/accounts/00000000-0000-0000-0000-000000000000",
        { method: "DELETE" }
      )
    );

    expect(res.status).toBe(HTTP_UNAUTHORIZED);
  });

  test("204 when the owner soft-deletes their own account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, password } = await seedVerifiedUser({
      email: "owner-delete@example.com",
    });
    const app = createApp();
    const cookie = await loginCookie(app, "owner-delete@example.com", password);

    const res = await app.handle(
      new Request(`http://localhost/api/v1/accounts/${account.id}`, {
        method: "DELETE",
        headers: { cookie },
      })
    );

    expect(res.status).toBe(204);
  });
});

describe("POST /api/v1/invitations/accept", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test(TEST_UNAUTHORIZED_NO_COOKIE, async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "any-long-enough-token-string-here" }),
      })
    );

    expect(res.status).toBe(HTTP_UNAUTHORIZED);
  });

  test("200 + adds the membership when an authenticated invitee accepts a valid token", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, membership } = await seedVerifiedUser({
      email: "host@example.com",
    });
    const { user: invitee, password } = await seedVerifiedUser({
      email: "invitee@example.com",
    });

    const { rawToken } = await invitationsService.create(
      {
        accountId: account.id,
        email: "invitee@example.com",
        roleToAssign: "member",
        invitedByMembershipId: membership.id,
      },
      membership.userId
    );

    const app = createApp();
    const cookie = await loginCookie(app, "invitee@example.com", password);

    const res = await app.handle(
      new Request("http://localhost/api/v1/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ token: rawToken }),
      })
    );

    expect(res.status).toBe(200);

    const membershipRows = await db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.userId, invitee.id));

    const joined = membershipRows.find((row) => row.accountId === account.id);

    expect(joined).toBeDefined();
    expect(joined?.role).toBe("member");
  });

  test("403 when a different authenticated user presents a valid invitation token", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, membership } = await seedVerifiedUser({
      email: "host-mismatch@example.com",
    });
    const { password } = await seedVerifiedUser({
      email: "wrong-invitee@example.com",
    });

    const { rawToken } = await invitationsService.create(
      {
        accountId: account.id,
        email: "actual-invitee@example.com",
        roleToAssign: "member",
        invitedByMembershipId: membership.id,
      },
      membership.userId
    );

    const app = createApp();
    const cookie = await loginCookie(
      app,
      "wrong-invitee@example.com",
      password
    );

    const res = await app.handle(
      new Request("http://localhost/api/v1/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ token: rawToken }),
      })
    );

    expect(res.status).toBe(403);
  });
});

describe("POST /api/v1/accounts/:id/invitations/:invitationId/resend", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test(TEST_UNAUTHORIZED_NO_COOKIE, async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request(
        "http://localhost/api/v1/accounts/00000000-0000-0000-0000-000000000000/invitations/00000000-0000-0000-0000-000000000001/resend",
        { method: "POST" }
      )
    );

    expect(res.status).toBe(HTTP_UNAUTHORIZED);
  });

  test("403 when resending for a foreign account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, membership, password } = await seedVerifiedUser({
      email: "resend-owner@example.com",
    });
    const { account: foreign } = await seedVerifiedUser({
      email: "resend-stranger@example.com",
    });

    const { invitation } = await invitationsService.create(
      {
        accountId: account.id,
        email: "teammate@example.com",
        roleToAssign: "member",
        invitedByMembershipId: membership.id,
      },
      membership.userId
    );

    const app = createApp();
    const cookie = await loginCookie(app, "resend-owner@example.com", password);

    const res = await app.handle(
      new Request(
        `http://localhost/api/v1/accounts/${foreign.id}/invitations/${invitation.id}/resend`,
        { method: "POST", headers: { cookie } }
      )
    );

    expect(res.status).toBe(403);
  });

  test("200 + new rawToken when the owner resends", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, membership, password } = await seedVerifiedUser({
      email: "resend-ok@example.com",
    });

    const created = await invitationsService.create(
      {
        accountId: account.id,
        email: "resend-target@example.com",
        roleToAssign: "member",
        invitedByMembershipId: membership.id,
      },
      membership.userId
    );

    const app = createApp();
    const cookie = await loginCookie(app, "resend-ok@example.com", password);

    const res = await app.handle(
      new Request(
        `http://localhost/api/v1/accounts/${account.id}/invitations/${created.invitation.id}/resend`,
        { method: "POST", headers: { cookie } }
      )
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (
      body === null ||
      typeof body !== "object" ||
      !("rawToken" in body) ||
      typeof body.rawToken !== "string"
    ) {
      throw new Error("resend response missing rawToken");
    }

    expect(body.rawToken).not.toBe(created.rawToken);
  });

  test("4th invitation resend for the same email is rate-limited", async () => {
    if (!(await requireDb())) {
      return;
    }

    const ownerEmail = uniqueEmail("resend-owner-rate-limit");
    const inviteeEmail = uniqueEmail("resend-target-rate-limit");

    const { account, membership, password } = await seedVerifiedUser({
      email: ownerEmail,
    });

    const created = await invitationsService.create(
      {
        accountId: account.id,
        email: inviteeEmail,
        roleToAssign: "member",
        invitedByMembershipId: membership.id,
      },
      membership.userId
    );

    const app = createApp();
    const cookie = await loginCookie(app, ownerEmail, password);

    const make = () =>
      app.handle(
        new Request(
          `http://localhost/api/v1/accounts/${account.id}/invitations/${created.invitation.id}/resend`,
          { method: "POST", headers: { cookie } }
        )
      );

    const first = await make();
    const second = await make();
    const third = await make();
    const fourth = await make();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    expect(fourth.status).toBe(400);

    const fourthBody: unknown = await fourth.json();

    expect(JSON.stringify(fourthBody)).toContain("Too many");
  });
});

describe("POST /api/v1/accounts/:id/transfer-ownership", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("403 when a demoted owner retries transfer (resolveFreshMembership)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, user, password } = await seedVerifiedUser({
      email: "transfer-demoted@example.com",
    });
    const { user: target } = await seedVerifiedUser({
      email: "transfer-target@example.com",
    });

    await db.insert(accountMemberships).values({
      accountId: account.id,
      userId: target.id,
      role: "admin",
    });

    await demoteToMember(user.id, account.id);

    const app = createApp();
    const cookie = await loginCookie(
      app,
      "transfer-demoted@example.com",
      password
    );

    const res = await app.handle(
      new Request(
        `http://localhost/api/v1/accounts/${account.id}/transfer-ownership`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({ toUserId: target.id }),
        }
      )
    );

    expect(res.status).toBe(403);
  });

  test("200 when the owner transfers to another member", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, user, password } = await seedVerifiedUser({
      email: "transfer-ok@example.com",
    });
    const { user: target } = await seedVerifiedUser({
      email: "transfer-ok-target@example.com",
    });

    await db.insert(accountMemberships).values({
      accountId: account.id,
      userId: target.id,
      role: "admin",
    });

    const app = createApp();
    const cookie = await loginCookie(app, "transfer-ok@example.com", password);

    const res = await app.handle(
      new Request(
        `http://localhost/api/v1/accounts/${account.id}/transfer-ownership`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({ toUserId: target.id }),
        }
      )
    );

    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.accountId, account.id));

    const formerOwner = rows.find((row) => row.userId === user.id);
    const newOwner = rows.find((row) => row.userId === target.id);

    expect(formerOwner?.role).toBe("admin");
    expect(newOwner?.role).toBe("owner");
  });
});

describe("DELETE /api/v1/accounts/:id/invitations/:invitationId", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("204 when the owner revokes a pending invitation", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, membership, password } = await seedVerifiedUser({
      email: "revoke-owner@example.com",
    });

    const { invitation, rawToken } = await invitationsService.create(
      {
        accountId: account.id,
        email: "revoke-target@example.com",
        roleToAssign: "member",
        invitedByMembershipId: membership.id,
      },
      membership.userId
    );

    const app = createApp();
    const cookie = await loginCookie(app, "revoke-owner@example.com", password);

    const res = await app.handle(
      new Request(
        `http://localhost/api/v1/accounts/${account.id}/invitations/${invitation.id}`,
        { method: "DELETE", headers: { cookie } }
      )
    );

    expect(res.status).toBe(204);

    const { password: inviteePassword } = await seedVerifiedUser({
      email: "revoke-target@example.com",
    });
    const inviteeCookie = await loginCookie(
      app,
      "revoke-target@example.com",
      inviteePassword
    );

    const acceptRes = await app.handle(
      new Request("http://localhost/api/v1/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: inviteeCookie },
        body: JSON.stringify({ token: rawToken }),
      })
    );

    expect(acceptRes.status).toBeGreaterThanOrEqual(400);
    expect(acceptRes.status).toBeLessThan(500);
  });
});
