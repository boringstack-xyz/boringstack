/**
 * F06: refresh-token replay detection remembers only one predecessor.
 *
 * `auth_sessions` carries exactly two slots, `tokenHash` and
 * `previousTokenHash` (schema/auth.schema.ts:179, :186), and
 * `session.service.ts:52-60` looks up only those two. Depth-1 replay is
 * handled correctly: hitting the `previous` slot deletes the whole family
 * transactionally (`:70-83`).
 *
 * After two rotations the row holds `{ tokenHash: H2, previousTokenHash: H1 }`.
 * Presenting T0 matches neither slot, falls through to `{ kind: "missing" }`
 * and surfaces as a generic "Invalid refresh session". No family delete, no
 * replay audit event, and T2 stays usable.
 *
 * `familyId` exists on the row and is only ever used as the deletion key, so
 * the lineage needed to detect this is not retained anywhere.
 *
 * The old token being refused is not the point: the point is that a proven
 * compromise of the family goes unnoticed and the live token survives.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sessionService } from "../src/api/auth/services/session.service";
import { createApp } from "../src/config/app/app";
import { generateOpaqueToken, hashOpaqueToken } from "../src/lib/tokens";
import { cleanDatabase, postgresClient } from "../tests/helpers/db";
import { seedVerifiedUser } from "../tests/helpers/auth";
import { requireDbOrFail, specPrecondition } from "./harness";

const LIVE = "still valid";
const REVOKED = "revoked";

/** The `name=value` pairs from a response's Set-Cookie headers. */
const cookiePairs = (res: Response): string =>
  res.headers
    .getAll("set-cookie")
    .map((chunk) => chunk.split(";")[0] ?? "")
    .filter((chunk) => chunk !== "")
    .join("; ");

const MIGRATION = join(
  import.meta.dir,
  "..",
  "drizzle",
  "0001_wild_gladiator.sql"
);

/**
 * The backfill statement as the migration actually carries it, so removing
 * it from the migration fails this suite rather than a copy kept in step by
 * hand. Empty when the migration carries none, an assertion, not a
 * precondition: a migration that leaves existing sessions behind is the
 * defect this case exists for.
 */
const backfillStatement = (): string => {
  const sql = readFileSync(MIGRATION, "utf8");
  const start = sql.lastIndexOf('INSERT INTO "auth"."session_retired_tokens"');

  return start === -1 ? "" : sql.slice(start);
};

beforeEach(async () => {
  await requireDbOrFail();
  await cleanDatabase();
});

describe("F06 refresh replay revokes the family", () => {
  test("replaying a two-generations-old token kills the live token", async () => {
    const { user } = await seedVerifiedUser({ email: "f06@example.com" });

    const t0 = await sessionService.create(user.id);
    const t1 = await sessionService.refresh(t0.token);
    const t2 = await sessionService.refresh(t1.token);

    // T0 is presented by an attacker who captured it two rotations ago.
    await sessionService.refresh(t0.token).catch(() => undefined);

    /*
     * The family is compromised, so the currently live token must stop
     * working. Today T2 refreshes happily.
     */
    const afterReplay = await sessionService
      .refresh(t2.token)
      .then(() => LIVE)
      .catch(() => REVOKED);

    expect(afterReplay).toBe(REVOKED);
  });

  test("control: depth-1 replay is already detected", async () => {
    const { user } = await seedVerifiedUser({ email: "f06b@example.com" });

    const t0 = await sessionService.create(user.id);
    const t1 = await sessionService.refresh(t0.token);

    await sessionService.refresh(t0.token).catch(() => undefined);

    const afterReplay = await sessionService
      .refresh(t1.token)
      .then(() => LIVE)
      .catch(() => REVOKED);

    expect(afterReplay).toBe(REVOKED);
  });

  test("a token retired before the lineage table existed is still evidence", async () => {
    const { user } = await seedVerifiedUser({ email: "f06d@example.com" });

    const t0 = await sessionService.create(user.id);
    const t1 = await sessionService.refresh(t0.token);

    /*
     * The shape every live session has at the moment the migration runs:
     * the retired hash exists only in the `previous_token_hash` slot,
     * because the lineage table did not exist when the rotation happened.
     * Deleting the row the service just wrote reproduces it exactly.
     */
    await postgresClient`delete from auth.session_retired_tokens`;

    const backfill = backfillStatement();

    expect(backfill).not.toBe("");

    await postgresClient.unsafe(backfill);

    const lineage = await postgresClient`
      select token_hash from auth.session_retired_tokens
    `;

    /*
     * Without the backfill the upgrade silently downgrades detection for
     * every session that predates it: the retired token matches no lineage
     * row, and only the rolling-deploy fallback in the service stands
     * between that and a compromised family staying alive.
     */
    expect(lineage).toHaveLength(1);

    await sessionService.refresh(t0.token).catch(() => undefined);

    const afterReplay = await sessionService
      .refresh(t1.token)
      .then(() => LIVE)
      .catch(() => REVOKED);

    expect(afterReplay).toBe(REVOKED);
  });

  test("a rotation on the new build keeps evidence an old replica left", async () => {
    const { user } = await seedVerifiedUser({ email: "f06e@example.com" });

    const t0 = await sessionService.create(user.id);
    const t1 = generateOpaqueToken();

    /*
     * The row an instance on the previous build leaves behind: it moved the
     * chain on and recorded the retired hash in the slot only, because the
     * lineage table is not something it knows to write.
     */
    await postgresClient`
      update auth.sessions
      set token_hash = ${hashOpaqueToken(t1)},
          previous_token_hash = ${hashOpaqueToken(t0.token)}
      where token_hash = ${hashOpaqueToken(t0.token)}
    `;
    await postgresClient`delete from auth.session_retired_tokens`;

    // The next rotation reaches this build, and overwrites that slot.
    const t2 = await sessionService.refresh(t1);

    await sessionService.refresh(t0.token).catch(() => undefined);

    /*
     * T0 was captured before the upgrade and is replayed after it. The one
     * write that carried it is gone, so unless the rotation preserved it
     * the replay is a generic unknown token: no revocation, no audit
     * event, and the family the attacker holds a token from stays live.
     */
    const rows = await postgresClient`select id from auth.sessions`;

    expect(rows).toHaveLength(0);

    const afterReplay = await sessionService
      .refresh(t2.token)
      .then(() => LIVE)
      .catch(() => REVOKED);

    expect(afterReplay).toBe(REVOKED);
  });

  test("deleting the family kills its retired tokens too", async () => {
    const { user } = await seedVerifiedUser({ email: "f06g@example.com" });

    const t0 = await sessionService.create(user.id);
    const t1 = await sessionService.refresh(t0.token);

    /*
     * The lineage rows cascade on the session delete, which is what makes
     * "revoke the family" a single statement. That only holds if the
     * cascade cannot leave something refreshable behind, so both ends are
     * asserted: the token the client currently holds, and the one the
     * lineage remembers.
     */
    await sessionService.revokeAllForUser(user.id);

    const live = await sessionService
      .refresh(t1.token)
      .then(() => LIVE)
      .catch(() => REVOKED);

    const retired = await sessionService
      .refresh(t0.token)
      .then(() => LIVE)
      .catch(() => REVOKED);

    expect(live).toBe(REVOKED);
    expect(retired).toBe(REVOKED);
    expect(await postgresClient`select id from auth.sessions`).toHaveLength(0);
  });

  test("an access token issued before a replay outlives it", async () => {
    const app = createApp();

    await seedVerifiedUser({ email: "f06h@example.com" });

    const loginRes = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "f06h@example.com",
          password: "Hunter2Strong!",
        }),
      })
    );

    const issued = cookiePairs(loginRes);

    specPrecondition(issued !== "", "login issued no cookies");

    const rotated = await app.handle(
      new Request("http://localhost/api/v1/auth/refresh", {
        method: "POST",
        headers: { cookie: issued },
      })
    );

    specPrecondition(
      rotated.status < 400,
      `refresh failed with ${String(rotated.status)}`
    );

    // Replay the token the rotation retired.
    await app.handle(
      new Request("http://localhost/api/v1/auth/refresh", {
        method: "POST",
        headers: { cookie: issued },
      })
    );

    const refreshAgain = await app.handle(
      new Request("http://localhost/api/v1/auth/refresh", {
        method: "POST",
        headers: { cookie: cookiePairs(rotated) },
      })
    );

    const probe = await app.handle(
      new Request("http://localhost/api/v1/users/me", {
        headers: { cookie: issued },
      })
    );

    /*
     * What replay detection does and does not do. The family is gone, so
     * no refresh token from it works again. The access JWT already in the
     * browser is not consulted against it and stays good for the rest of
     * its 15 minutes.
     *
     * Recorded rather than fixed here. Killing it means a user-wide
     * revocation, which signs the user out of unrelated sessions, and that
     * is a product decision rather than a bug fix. `docs/agents/
     * authentication.md` carries the operational note.
     */
    expect(refreshAgain.status).toBeGreaterThanOrEqual(400);
    expect(probe.status).toBe(200);
  });

  test("control: ordinary rotation keeps working", async () => {
    const { user } = await seedVerifiedUser({ email: "f06c@example.com" });

    const t0 = await sessionService.create(user.id);
    const t1 = await sessionService.refresh(t0.token);
    const t2 = await sessionService.refresh(t1.token);

    expect(t2.token).toBeString();
  });
});
