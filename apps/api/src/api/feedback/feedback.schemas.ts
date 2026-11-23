import { t } from "elysia";

import {
  FEEDBACK_ANSWER_MAX_LENGTH,
  FEEDBACK_MOMENTS,
} from "./feedback.constants";

export const FeedbackMomentParams = t.Object({
  moment: t.UnionEnum([...FEEDBACK_MOMENTS]),
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
