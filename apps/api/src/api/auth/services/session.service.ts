import { now } from "../../../lib/time/now";
import { and, eq, gt, or } from "drizzle-orm";
import { db } from "../../../clients/postgres";
import { authSessions, users } from "../../../clients/postgres/schema";
import { AUDIT_ACTIONS, auditLogService } from "../../../lib/audit-log";
import { ApiErrors } from "../../../lib/errors";
import { jwtRevocationService } from "../../../lib/jwt";
import { generateOpaqueToken, hashOpaqueToken } from "../../../lib/tokens";
import { REFRESH_SESSION_TTL_MS } from "../auth.constants";
import type {
  ICreatedSession,
  IRefreshOutcome,
  IRefreshedSession,
} from "../auth.types";
import { toPublicUser } from "../auth.utils";

export class SessionService {
  async create(userId: string): Promise<ICreatedSession> {
    const token = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(token);
    const expiresAt = this.nextExpiry();

    await db.insert(authSessions).values({
      userId,
      tokenHash,
      expiresAt,
    });

    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_SESSION_CREATED,
    });

    return { token, expiresAt };
  }

  async refresh(token: string): Promise<IRefreshedSession> {
    const tokenHash = hashOpaqueToken(token);
    const nowIso = now();
    const nextToken = generateOpaqueToken();
    const nextTokenHash = hashOpaqueToken(nextToken);
    const nextExpiresAt = this.nextExpiry();

    /*
     * Atomic detect-and-rotate. The two write paths (replay → revoke family,
     * valid → rotate) are mutually exclusive but must each be transactional:
     * a partial failure on the replay branch would leave a compromised
     * family alive; a partial failure on the rotate branch would issue a
     * token nobody can refresh.
     */
    const outcome = await db.transaction(
      async (tx): Promise<IRefreshOutcome> => {
        const session = await tx.query.authSessions.findFirst({
          where: or(
            eq(authSessions.tokenHash, tokenHash),
            eq(authSessions.previousTokenHash, tokenHash)
          ),
        });

        if (session === undefined) {
          return { kind: "missing" };
        }

        /*
         * Replay: the presented token matches the *previous* slot, not the
         * current one. Someone is reusing a token we already issued a
         * successor for. Kill the entire family.
         */
        if (session.tokenHash !== tokenHash) {
          await tx
            .delete(authSessions)
            .where(eq(authSessions.familyId, session.familyId));

          return {
            kind: "replay",
            userId: session.userId,
            sessionId: session.id,
            familyId: session.familyId,
          };
        }

        if (session.expiresAt <= nowIso) {
          return { kind: "expired" };
        }

        const [rotated] = await tx
          .update(authSessions)
          .set({
            previousTokenHash: tokenHash,
            tokenHash: nextTokenHash,
            expiresAt: nextExpiresAt,
            updatedAt: nowIso,
          })
          .where(
            and(
              eq(authSessions.id, session.id),
              eq(authSessions.tokenHash, tokenHash),
              gt(authSessions.expiresAt, nowIso)
            )
          )
          .returning({ userId: authSessions.userId });

        if (rotated === undefined) {
          return { kind: "missing" };
        }

        return { kind: "rotated", userId: rotated.userId };
      }
    );

    if (outcome.kind === "replay") {
      void auditLogService.record({
        userId: outcome.userId,
        action: AUDIT_ACTIONS.AUTH_REFRESH_REPLAY,
        metadata: {
          sessionId: outcome.sessionId,
          familyId: outcome.familyId,
        },
      });

      throw ApiErrors.unauthorized("Refresh token replay detected");
    }

    if (outcome.kind !== "rotated") {
      throw ApiErrors.unauthorized("Invalid refresh session");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, outcome.userId),
    });

    if (!user) {
      await this.revoke(nextToken);

      throw ApiErrors.unauthorized("Refresh session user not found");
    }

    return { token: nextToken, user: toPublicUser(user) };
  }

  async revoke(token: string): Promise<void> {
    const tokenHash = hashOpaqueToken(token);
    const revoked = await db
      .delete(authSessions)
      .where(
        or(
          eq(authSessions.tokenHash, tokenHash),
          eq(authSessions.previousTokenHash, tokenHash)
        )
      )
      .returning({ userId: authSessions.userId });

    for (const session of revoked) {
      void auditLogService.record({
        userId: session.userId,
        action: AUDIT_ACTIONS.AUTH_SESSION_REVOKED,
      });
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await db.delete(authSessions).where(eq(authSessions.userId, userId));

    /*
     * Refresh sessions and access JWTs are coupled: a refresh session
     * lasts 30 days, an access JWT 15 min. Without this second call,
     * "revoke all sessions" would leave up to 15 min of pre-revocation
     * access tokens alive — defeating the point. Bumping the per-user
     * revoke-before-iat cutoff kills every previously issued access
     * token without enumerating their JTIs.
     */
    await jwtRevocationService.revokeAllForUser(userId);

    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.AUTH_SESSIONS_REVOKED,
    });
  }

  private nextExpiry(): string {
    return new Date(Date.now() + REFRESH_SESSION_TTL_MS).toISOString();
  }
}

export const sessionService = new SessionService();
