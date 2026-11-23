import { t } from "elysia";

import {
  FEEDBACK_ANSWER_MAX_LENGTH,
  FEEDBACK_MOMENT_PATTERN,
} from "./feedback.constants";

/*
 * A string checked by pattern, not `t.UnionEnum`: Elysia writes defaults into
 * path params, and an enum default cannot be written onto them (500 on every
 * call). `isFeedbackMoment` narrows the value in the handler.
 */
export const feedbackMomentParams = () =>
  t.Object({
    moment: t.String({ pattern: FEEDBACK_MOMENT_PATTERN, maxLength: 32 }),
  });

export const FeedbackShowResponse = t.Object({
  /* True only for the call that claimed the moment: show the prompt now. */
  show: t.Boolean(),
});

export const FeedbackAnswerBodySchema = t.Object({
  /* Empty with `dismissed` when the person closed the prompt. */
  answer: t.String({ maxLength: FEEDBACK_ANSWER_MAX_LENGTH }),
  dismissed: t.Boolean(),
});
