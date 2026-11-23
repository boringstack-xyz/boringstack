import type { ChangeEvent } from "react";

import type { TFeedbackMoment } from "../../Feedback.types";

export interface IFeedbackPromptProps {
  /** The moment in the product the question is asked at. Asked once per person. */
  readonly moment: TFeedbackMoment;
}

export interface IFeedbackPromptView {
  readonly isOpen: boolean;
  readonly text: string;
  readonly maxLength: number;
  readonly isSaving: boolean;
  readonly onTextChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  readonly onSubmit: () => void;
  readonly onDismiss: () => void;
}
