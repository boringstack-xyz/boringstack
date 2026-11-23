import type { FEEDBACK_MOMENTS } from "./feedback.constants";

export type TFeedbackMoment = (typeof FEEDBACK_MOMENTS)[number];

export interface IFeedbackOwner {
  readonly accountId: string;
  readonly userId: string;
  readonly email: string;
}
