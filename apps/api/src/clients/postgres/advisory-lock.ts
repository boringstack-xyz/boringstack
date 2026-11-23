import { sql } from "drizzle-orm";

interface IExecuteTx {
  readonly execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
}

/*
 * Transaction-scoped lock on a named key, hashed by Postgres. Use it where a
 * count and the write that depends on it must not interleave, such as a seat
 * cap checked before a membership insert. Callers that lock the same key must
 * pass the same string: the lock is released at commit or rollback.
 */
export const acquireKeyedAdvisoryLock = async (
  tx: IExecuteTx,
  key: string
): Promise<void> => {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
};
