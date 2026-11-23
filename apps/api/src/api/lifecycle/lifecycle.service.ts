import {
  and,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  like,
  lte,
  ne,
  notExists,
  notLike,
  or,
  type SQL,
} from "drizzle-orm";

import { db } from "../../clients/postgres";
import {
  accountMemberships,
  accountPlans,
  authSessions,
  notification,
  notificationPreference,
  plans,
  users,
} from "../../clients/postgres/schema";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { isValidEmail } from "../../lib/email/email.utils";
import { getErrorMessage } from "../../lib/errors";
import { notifications } from "../../lib/notifications/dispatch/notifications.dispatcher";
import { notificationPreferencesService } from "../../lib/notifications/preferences/preferences.service";
import { nowMs } from "../../lib/time/now";
import { SYNTHETIC_EMAIL_DOMAIN } from "../../lib/synthetic";
import { PLAN_NAME } from "../billing/billing.constants";
import { LIFECYCLE_EVENTS } from "../notifications/events";
import {
  LIFECYCLE_BATCH_SIZE,
  LIFECYCLE_CTA_PATH,
  LIFECYCLE_EVENT_PREFIX,
  LIFECYCLE_MIN_GAP_MS,
  LIFECYCLE_STAGES,
  LIFECYCLE_SWEEP_ORDER,
  LIFECYCLE_WINDOWS,
} from "./lifecycle.constants";
import type {
  ILifecycleCandidate,
  ILifecycleSweepResult,
  LifecycleStage,
} from "./lifecycle.types";
import {
  lifecycleEventType,
  signUnsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
  withEmailUtm,
} from "./lifecycle.utils";

/**
 * Follow-up emails after sign-up. A scheduled sweep finds who is due which
 * stage; each stage's email goes out at most once per person, at most one a
 * day, never to admins, the verification robot, unverified accounts or paying
 * accounts, and never after the person unsubscribes.
 *
 * Adding a stage: add it to LIFECYCLE_STAGES, LIFECYCLE_WINDOWS,
 * LIFECYCLE_CTA_PATH and LIFECYCLE_SWEEP_ORDER, an event in
 * notifications/events/lifecycle.event.ts, a template, and a case in
 * `stageFilter`. The compiler flags every map that is missing a key.
 */
export class LifecycleService {
  async candidates(stage: LifecycleStage): Promise<ILifecycleCandidate[]> {
    return db
      .select({ userId: users.id, firstName: users.firstName })
      .from(users)
      .where(
        and(
          this.reachableUser(),
          this.neverPaid(),
          this.notYetNudged(stage),
          this.stageFilter(stage)
        )
      )
      .limit(LIFECYCLE_BATCH_SIZE);
  }

  async sweep(): Promise<ILifecycleSweepResult> {
    /* Add one key per stage; the type makes a missing one a compile error. */
    const sent: Record<LifecycleStage, number> = {
      "welcome-follow-up": 0,
    };

    if (!env.LIFECYCLE_EMAILS_ENABLED) {
      return { sent };
    }

    const nudgedThisSweep = new Set<string>();

    for (const stage of LIFECYCLE_SWEEP_ORDER) {
      const due = await this.candidates(stage);

      for (const candidate of due) {
        if (nudgedThisSweep.has(candidate.userId)) {
          continue;
        }

        nudgedThisSweep.add(candidate.userId);

        try {
          await this.send(stage, candidate);
          sent[stage] += 1;
        } catch (error: unknown) {
          logger.error("Lifecycle email failed to dispatch", {
            event: "lifecycle.send_failed",
            stage,
            userId: candidate.userId,
            error: getErrorMessage(error),
          });
        }
      }
    }

    logger.info("Lifecycle sweep completed", {
      event: "lifecycle.sweep.completed",
      sent,
    });

    return { sent };
  }

  /**
   * Turns off every follow-up email (and its in-app twin) for the person the
   * token was issued to. Returns false for a token that doesn't verify.
   * Works whether or not LIFECYCLE_EMAILS_ENABLED is set.
   */
  async unsubscribe(token: string): Promise<boolean> {
    const userId = verifyUnsubscribeToken(token, env.JWT_SECRET);

    if (userId === null) {
      return false;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true },
    });

    if (user === undefined) {
      return false;
    }

    await notificationPreferencesService.update({
      userId,
      preferences: LIFECYCLE_STAGES.flatMap((stage) =>
        ["email", "in-app"].map((channel) => ({
          eventType: lifecycleEventType(stage),
          channel,
          enabled: false,
        }))
      ),
    });

    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.LIFECYCLE_UNSUBSCRIBED,
    });

    logger.info("Unsubscribed from follow-up emails", {
      event: "lifecycle.unsubscribed",
      userId,
    });

    return true;
  }

  private async send(
    stage: LifecycleStage,
    candidate: ILifecycleCandidate
  ): Promise<void> {
    const token = signUnsubscribeToken(candidate.userId, env.JWT_SECRET);

    await notifications.send(LIFECYCLE_EVENTS[stage], {
      recipientUserId: candidate.userId,
      payload: {
        firstName: candidate.firstName,
        ctaUrl: withEmailUtm(
          `${env.FRONTEND_URL}${LIFECYCLE_CTA_PATH[stage]}`,
          stage
        ),
        unsubscribeUrl: unsubscribeUrl(env.PUBLIC_API_URL, token),
        replyTo: isValidEmail(env.EMAIL_REPLY_TO) ? env.EMAIL_REPLY_TO : "",
      },
    });
  }

  private isoAgo(ms: number): string {
    return new Date(nowMs() - ms).toISOString();
  }

  /** Admins, the verification robot and the unverified get no follow-up email. */
  private reachableUser(): SQL | undefined {
    return and(
      eq(users.isPlatformAdmin, false),
      notLike(users.email, `%@${SYNTHETIC_EMAIL_DOMAIN}`),
      isNotNull(users.emailVerifiedAt)
    );
  }

  /** Anyone on (or once on) a paid plan is never nudged. */
  private neverPaid(): SQL {
    return notExists(
      db
        .select({ id: accountMemberships.id })
        .from(accountMemberships)
        .innerJoin(
          accountPlans,
          eq(accountPlans.accountId, accountMemberships.accountId)
        )
        .innerJoin(plans, eq(plans.id, accountPlans.planId))
        .where(
          and(
            eq(accountMemberships.userId, users.id),
            isNull(accountMemberships.revokedAt),
            or(
              and(
                isNull(accountPlans.revokedAt),
                ne(plans.name, PLAN_NAME.free)
              ),
              isNotNull(accountPlans.stripeSubscriptionId)
            )
          )
        )
    );
  }

  /** Not unsubscribed from this stage, never sent it, and no follow-up lately. */
  private notYetNudged(stage: LifecycleStage): SQL | undefined {
    return and(
      notExists(
        db
          .select({ id: notificationPreference.id })
          .from(notificationPreference)
          .where(
            and(
              eq(notificationPreference.userId, users.id),
              eq(notificationPreference.eventType, lifecycleEventType(stage)),
              eq(notificationPreference.channel, "email"),
              eq(notificationPreference.enabled, false)
            )
          )
      ),
      notExists(
        db
          .select({ id: notification.id })
          .from(notification)
          .where(
            and(
              eq(notification.recipientUserId, users.id),
              or(
                eq(notification.eventType, lifecycleEventType(stage)),
                and(
                  like(notification.eventType, `${LIFECYCLE_EVENT_PREFIX}%`),
                  gt(notification.createdAt, this.isoAgo(LIFECYCLE_MIN_GAP_MS))
                )
              )
            )
          )
      )
    );
  }

  /*
   * One predicate per stage, keyed by stage: a stage without one is a
   * compile error rather than a silent no-match.
   */
  private stageFilter(stage: LifecycleStage): SQL | undefined {
    const filters: Record<LifecycleStage, () => SQL | undefined> = {
      /*
       * EXAMPLE stage: signed up between two and seven days ago, and no
       * session touched in the last two days, so the person has not been
       * back since. Replace with the product's own condition.
       */
      "welcome-follow-up": () => {
        const window = LIFECYCLE_WINDOWS["welcome-follow-up"];

        return and(
          gte(users.createdAt, this.isoAgo(window.toMs)),
          lte(users.createdAt, this.isoAgo(window.fromMs)),
          notExists(
            db
              .select({ id: authSessions.id })
              .from(authSessions)
              .where(
                and(
                  eq(authSessions.userId, users.id),
                  gt(authSessions.updatedAt, this.isoAgo(window.fromMs))
                )
              )
          )
        );
      },
    };

    return filters[stage]();
  }
}

export const lifecycleService = new LifecycleService();
