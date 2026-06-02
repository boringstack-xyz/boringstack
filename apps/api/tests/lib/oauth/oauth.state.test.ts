import { afterAll, describe, expect, test } from "bun:test";
import { Redis } from "ioredis";

import { getValkeyAppClientOptions } from "../../../src/clients/valkey";
import { OAUTH_STATE_PREFIX } from "../../../src/lib/oauth/oauth.constants";
import { oauthStateStore } from "../../../src/lib/oauth/oauth.state";

/*
 * Seeds raw values under the OAuth state prefix to exercise consume()'s
 * handling of corrupted store contents — something store() can never
 * produce, so it needs a direct client.
 */
const seedClient = new Redis(
  getValkeyAppClientOptions({ connectTimeout: 500 })
);

const SEED_TTL_SECONDS = 30;

afterAll(async () => {
  try {
    await seedClient.quit();
  } catch {
    seedClient.disconnect();
  }

  await oauthStateStore.close();
});

describe("oauthStateStore.consume", () => {
  test("round-trips a stored state and burns it on first read", async () => {
    await oauthStateStore.store("state-roundtrip", { codeVerifier: "v" });

    const first = await oauthStateStore.consume("state-roundtrip");

    expect(first).toEqual({ codeVerifier: "v" });

    const replay = await oauthStateStore.consume("state-roundtrip");

    expect(replay).toBeNull();
  });

  test("returns null for an unknown state", async () => {
    const got = await oauthStateStore.consume("state-never-stored");

    expect(got).toBeNull();
  });

  test("returns null when the stored value is not JSON", async () => {
    await seedClient.setex(
      `${OAUTH_STATE_PREFIX}state-garbage`,
      SEED_TTL_SECONDS,
      "not-json{"
    );

    const got = await oauthStateStore.consume("state-garbage");

    expect(got).toBeNull();
  });

  test("returns null when the stored value is a JSON scalar", async () => {
    await seedClient.setex(
      `${OAUTH_STATE_PREFIX}state-scalar`,
      SEED_TTL_SECONDS,
      '"just-a-string"'
    );

    const got = await oauthStateStore.consume("state-scalar");

    expect(got).toBeNull();
  });

  test("strips unknown fields from a stored object", async () => {
    await seedClient.setex(
      `${OAUTH_STATE_PREFIX}state-extra-fields`,
      SEED_TTL_SECONDS,
      JSON.stringify({ codeVerifier: "v", role: "superadmin" })
    );

    const got = await oauthStateStore.consume("state-extra-fields");

    expect(got).toEqual({ codeVerifier: "v" });
  });
});
