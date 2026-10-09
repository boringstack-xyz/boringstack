/*
 * One TLS policy for every Postgres connection the API opens: the runtime
 * client (postgres-js, src/clients/postgres/index.ts) and the migration path
 * (drizzle-kit, drizzle.config.ts). Both must trust the same CA, or migrations
 * can pass against a trust store the app then refuses at boot.
 *
 * Pure on purpose: no env import, so drizzle.config.ts can use it without
 * running the full API env validation.
 */

export interface IPostgresTlsSettings {
  readonly isProduction: boolean;
  readonly rejectUnauthorized: boolean;
  /** PEM-encoded CA bundle that signed the server certificate. Empty = system CAs. */
  readonly ca: string;
}

export type PostgresSsl = false | { rejectUnauthorized: boolean; ca?: string };

export const buildPostgresSsl = ({
  isProduction,
  rejectUnauthorized,
  ca,
}: IPostgresTlsSettings): PostgresSsl => {
  return !isProduction
    ? false
    : { rejectUnauthorized, ...(ca !== "" && { ca }) };
};

export type DrizzleCredentials =
  | { url: string }
  | {
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
      ssl: Exclude<PostgresSsl, false>;
    };

/*
 * drizzle-kit only accepts `ssl` alongside host-based credentials, not with
 * `{ url }`. When TLS is on, split the URL into parts and carry the same ssl
 * object the runtime client uses. Any `sslmode` query parameter is ignored
 * here, so keep TLS policy in DATABASE_SSL_* rather than in the URL.
 */
export const buildDrizzleCredentials = (
  databaseUrl: string,
  ssl: PostgresSsl
): DrizzleCredentials => {
  if (ssl === false) {
    return { url: databaseUrl };
  }

  const parsed = new URL(databaseUrl);

  return {
    host: parsed.hostname,
    port: parsed.port === "" ? 5432 : Number(parsed.port),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    ssl,
  };
};
