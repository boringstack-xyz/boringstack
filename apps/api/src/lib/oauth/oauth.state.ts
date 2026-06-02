import { Redis } from "ioredis";
import { getValkeyAppClientOptions } from "../../clients/valkey";
import { logger } from "../../config/logger";
import { OAUTH_STATE_PREFIX, OAUTH_STATE_TTL_SECONDS } from "./oauth.constants";
import type { IStoredState } from "./oauth.types";

/**
 * OAuth state store.
 *
 * State must survive the redirect → callback hop and survive horizontal
 * scaling, so a signed cookie isn't enough. Valkey with a short TTL is
 * the canonical answer. This module owns its own ioredis client because
 * OAuth must work even when CACHE_ENABLED=false.
 */
class OAuthStateStore {
  private client: Redis | null = null;

  private getClient(): Redis {
    if (this.client !== null) {
      return this.client;
    }

    const redisClient = new Redis(
      getValkeyAppClientOptions({ connectTimeout: 500 })
    );

    redisClient.on("error", (err: Error) => {
      logger.warn("OAuth state Valkey error", {
        event: "oauth_state_valkey_error",
        error: err.message,
      });
    });

    this.client = redisClient;

    return redisClient;
  }

  async close(): Promise<void> {
    if (this.client === null) {
      return;
    }

    try {
      if (this.client.status === "ready") {
        await this.client.quit();
      } else {
        this.client.disconnect();
      }
    } catch {
      // ignore — connection may already be closing
    }

    this.client = null;
  }

  /**
   * Persist a one-time state token (and optional PKCE verifier) for the
   * duration of one OAuth round-trip.
   */
  async store(state: string, stored: IStoredState = {}): Promise<void> {
    await this.getClient().setex(
      `${OAUTH_STATE_PREFIX}${state}`,
      OAUTH_STATE_TTL_SECONDS,
      JSON.stringify(stored)
    );
  }

  /**
   * Read + delete the stored state. Returns `null` if absent (expired,
   * forged, or already consumed) — and equally if the stored value is
   * not a JSON object: corrupted state must fail the flow, not pass as
   * a valid state with no extras. Read-and-delete makes replay
   * impossible.
   */
  async consume(state: string): Promise<IStoredState | null> {
    const key = `${OAUTH_STATE_PREFIX}${state}`;
    const raw = await this.getClient().getdel(key);

    if (raw === null) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);

      if (parsed === null || typeof parsed !== "object") {
        return null;
      }

      const result: IStoredState = {};

      if ("codeVerifier" in parsed && typeof parsed.codeVerifier === "string") {
        result.codeVerifier = parsed.codeVerifier;
      }

      if ("linkUserId" in parsed && typeof parsed.linkUserId === "string") {
        result.linkUserId = parsed.linkUserId;
      }

      return result;
    } catch {
      return null;
    }
  }
}

export const oauthStateStore = new OAuthStateStore();
