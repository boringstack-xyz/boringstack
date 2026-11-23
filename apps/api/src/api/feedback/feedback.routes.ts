import { buildScopedRateLimit } from "../../config/security";
import { errorHandler } from "../../middleware/error-handler";
import { requireAuth } from "../auth/auth.plugin";
import { FEEDBACK_RATE_LIMIT } from "./feedback.constants";
import {
  FeedbackAnswerBodySchema,
  FeedbackMomentParams,
  FeedbackShowResponse,
} from "./feedback.schemas";
import { feedbackService } from "./feedback.service";

const TAG = "Feedback";

/*
 * The one-question prompt. The app asks to show it at a moment; the server
 * says yes once per person per moment, then stores the answer.
 */
const feedbackRoutes = requireAuth()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .use(buildScopedRateLimit("feedback", FEEDBACK_RATE_LIMIT))
  .post(
    "/:moment/show",
    async ({ user, accountId, params }) => ({
      show: await feedbackService.claim(
        { accountId, userId: user.id, email: user.email },
        params.moment
      ),
    }),
    {
      params: FeedbackMomentParams,
      response: FeedbackShowResponse,
      detail: {
        tags: [TAG],
        summary: "Claim a feedback moment; true only the first time",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .put(
    "/:moment",
    async ({ user, accountId, params, body, set }) => {
      await feedbackService.answer(
        { accountId, userId: user.id, email: user.email },
        params.moment,
        body.answer,
        body.dismissed
      );
      set.status = 204;

      return null;
    },
    {
      params: FeedbackMomentParams,
      body: FeedbackAnswerBodySchema,
      detail: {
        tags: [TAG],
        summary: "Answer or dismiss the feedback prompt",
        security: [{ cookieAuth: [] }],
      },
    }
  );

export default feedbackRoutes;
