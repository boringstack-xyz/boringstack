/**
 * Sensitive-data boundary for structured logs.
 *
 * Everything logged crosses into Loki and the error tracker, so it needs a
 * boundary here: `error-handler.ts` passes generic error messages through
 * `getErrorMessage` untouched, and a Postgres error embeds the query
 * parameters — for an auth query, the credential itself.
 *
 * Two mechanisms, because one is not enough:
 *
 *   1. Key-based. A field whose NAME says it holds a credential is censored
 *      whatever its value looks like. Cheap, exact, and it covers the common
 *      `{ refreshToken }` / `{ passwordHash }` shapes.
 *   2. Value-based. A secret is often embedded in a legitimate field —
 *      `message` is the important one, since driver errors append
 *      `params: <every bound value>`. No key rule can catch that, so known
 *      secret-bearing shapes are scrubbed out of string values too.
 *
 * The boundary must not be achieved by logging less: an incident needs the
 * route, the event and the user id. Only the parts that carry credentials
 * are removed.
 */
export const CENSOR = "[redacted]";

/*
 * Matched case-insensitively against the whole key and against its last
 * camelCase segment, so `passwordHash`, `refreshToken` and
 * `mfaSecretEncrypted` are all caught without listing every combination.
 */
const SENSITIVE_KEY_PARTS: readonly string[] = [
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "credential",
  "apikey",
  "privatekey",
  "recoverycode",
  "passphrase",
  "otp",
  "pin",
];

/*
 * Fields whose names contain a sensitive word but which are safe and
 * operationally necessary. `tokenHash` identifies a row without being usable
 * as a credential; `csrfToken` presence is a debugging signal, not a secret
 * worth protecting once the session is already compromised.
 */
const ALLOWED_KEYS = new Set(["tokenhash", "tokentype", "tokenexpiresat"]);

const isSensitiveKey = (key: string): boolean => {
  const lower = key.toLowerCase();

  if (ALLOWED_KEYS.has(lower)) {
    return false;
  }

  return SENSITIVE_KEY_PARTS.some((part) => lower.includes(part));
};

/*
 * `params: a,b,c` is how `postgres`/Drizzle append bound values to a failed
 * query — every parameter of the statement, which for an auth query is the
 * credential itself. The tail runs to end of line.
 */
const QUERY_PARAMS = /(\bparams:)[^\n]*/giu;

/* PHC-format hashes (argon2, bcrypt, scrypt) wherever they appear. */
const PHC_HASH = /\$(?:argon2[a-z]*|2[aby]|scrypt|pbkdf2[^$\s]*)\$[^\s"']+/giu;

/* `Authorization: Bearer <credential>` and bare JWTs. */
const BEARER = /\bBearer\s+[\w.~+/-]+=*/giu;
const JWT = /\beyJ[\w-]*\.[\w-]+\.[\w-]+/gu;

export const scrubText = (value: string): string =>
  value
    .replace(QUERY_PARAMS, `$1 ${CENSOR}`)
    .replace(PHC_HASH, CENSOR)
    .replace(BEARER, `Bearer ${CENSOR}`)
    .replace(JWT, CENSOR);

/*
 * Depth cap. Log context is shallow by convention, and an unbounded walk on
 * a cyclic or pathological object would turn a log call into a hang.
 *
 * A subtree at the cap is replaced rather than emitted: the walk cannot see
 * inside it, so passing it through would publish exactly the values the cap
 * stopped it from inspecting — a secret nested one level too deep, or
 * deliberately buried there.
 */
const MAX_DEPTH = 6;

export const DEPTH_LIMIT = "[redacted: depth limit]";

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const redactValue = (value: unknown, depth: number): unknown => {
  if (typeof value === "string") {
    return scrubText(value);
  }

  if (!Array.isArray(value) && !isPlainRecord(value)) {
    return value;
  }

  if (depth >= MAX_DEPTH) {
    return DEPTH_LIMIT;
  }

  if (Array.isArray(value)) {
    return value.map((entry: unknown) => redactValue(entry, depth + 1));
  }

  return redactRecord(value, depth + 1);
};

export const redactRecord = (
  input: Record<string, unknown>,
  depth = 0
): Record<string, unknown> => {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    output[key] = isSensitiveKey(key) ? CENSOR : redactValue(value, depth);
  }

  return output;
};
