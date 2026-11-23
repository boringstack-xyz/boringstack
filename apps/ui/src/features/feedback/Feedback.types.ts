import type { FEEDBACK_MOMENTS } from "./Feedback.constants";

export type TFeedbackMoment = (typeof FEEDBACK_MOMENTS)[number];

export interface IAnswerFeedbackInput {
  readonly moment: TFeedbackMoment;
  readonly answer: string;
  readonly dismissed: boolean;
}
