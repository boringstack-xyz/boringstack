import { FEEDBACK_MOMENTS } from "./feedback.constants";
import type { TFeedbackMoment } from "./feedback.types";

/** Narrows a path value to a known moment; anything else is not a moment. */
export const isFeedbackMoment = (value: string): value is TFeedbackMoment =>
  FEEDBACK_MOMENTS.some((moment) => moment === value);
