import { and, eq } from "drizzle-orm";

import { db } from "../../clients/postgres";
import { feedbackAnswers } from "../../clients/postgres/schema";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { isSyntheticEmail } from "../../lib/synthetic";
import { now } from "../../lib/time/now";
import type { IFeedbackOwner, TFeedbackMoment } from "./feedback.types";

class FeedbackService {
  /*
   * Claims the moment for this person. The unique (user, moment) row makes
   * a second tab, a reload or a race lose: only the first caller shows it.
   * The verification robot is never prompted.
   */
  async claim(
    owner: IFeedbackOwner,
    moment: TFeedbackMoment
  ): Promise<boolean> {
    if (isSyntheticEmail(owner.email)) {
      return false;
    }

    const timestamp = now();
    const inserted = await db
      .insert(feedbackAnswers)
      .values({
        accountId: owner.accountId,
        userId: owner.userId,
        moment,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoNothing({
        target: [feedbackAnswers.userId, feedbackAnswers.moment],
      })
      .returning({ id: feedbackAnswers.id });

    return inserted.length > 0;
  }

  /* Saves the answer (or the dismissal) to a prompt this person was shown. */
  async answer(
    owner: IFeedbackOwner,
    moment: TFeedbackMoment,
    answer: string,
    dismissed: boolean
  ): Promise<void> {
    const text = answer.trim();
    const [row] = await db
      .update(feedbackAnswers)
      .set({
        state: dismissed || text === "" ? "dismissed" : "answered",
        answer: dismissed ? "" : text,
        updatedAt: now(),
      })
      .where(
        and(
          eq(feedbackAnswers.accountId, owner.accountId),
          eq(feedbackAnswers.userId, owner.userId),
          eq(feedbackAnswers.moment, moment),
          eq(feedbackAnswers.state, "shown")
        )
      )
      .returning({ id: feedbackAnswers.id, state: feedbackAnswers.state });

    if (row) {
      void auditLogService.record({
        userId: owner.userId,
        targetAccountId: owner.accountId,
        action: AUDIT_ACTIONS.FEEDBACK_ANSWERED,
        metadata: { resourceId: row.id, moment, state: row.state },
      });
    }
  }
}

export const feedbackService = new FeedbackService();
