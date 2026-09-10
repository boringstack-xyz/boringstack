export type AuthJWTPayloadResult =
  | {
      kind: "ok";
      userId: string;
      accountId: string;
      /**
       * Random per-issuance ID. Present on tokens issued since the
       * revocation feature shipped; absent on legacy tokens, in which
       * case per-jti revocation is skipped.
       */
      jti: string | null;
      /**
       * JWT-standard issued-at (seconds since epoch). Same legacy-token
       * caveat as `jti`.
       */
      issuedAt: number | null;
      /**
       * JWT-standard expiry (seconds since epoch). Long-lived consumers,
       * anything that holds a connection open rather than answering one
       * request, must re-check this themselves; the guard only reads it
       * once, when the request arrives.
       */
      expiresAt: number | null;
    }
  | { kind: "invalid" };
