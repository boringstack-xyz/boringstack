import { useEffect, useRef, useState } from "react";

import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { logger } from "@/lib/logger/logger";

import { FEEDBACK_ANSWER_MAX_LENGTH } from "../../Feedback.constants";
import {
  useAnswerFeedback,
  useClaimFeedbackMoment
} from "../../Feedback.mutations";
import type {
  IFeedbackPromptProps,
  IFeedbackPromptView
} from "./FeedbackPrompt.types";

/*
 * Asks the server once for this moment. The server answers true only the first
 * time, so a reload or a second tab never asks again. Answering or dismissing
 * closes the prompt at once; a failed save is logged, not shown as an error.
 */
export const useFeedbackPrompt = ({
  moment
}: IFeedbackPromptProps): IFeedbackPromptView => {
  const { mutateAsync: claimMoment } = useClaimFeedbackMoment();
  const answer = useAnswerFeedback();
  const claimed = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (claimed.current) {
      return;
    }

    claimed.current = true;
    claimMoment(moment)
      .then((show) => {
        setIsOpen(show);
      })
      .catch((error: unknown) => {
        logger.warn({
          event: "feedback.claim_failed",
          moment,
          error: getErrorMessage(error)
        });
      });
  }, [claimMoment, moment]);

  const close = (dismissed: boolean): void => {
    setIsOpen(false);
    answer.mutate(
      {
        moment,
        answer: dismissed ? "" : text.trim(),
        dismissed
      },
      {
        onError: (error: unknown) => {
          logger.warn({
            event: "feedback.answer_failed",
            moment,
            error: getErrorMessage(error)
          });
        }
      }
    );
  };

  return {
    isOpen,
    text,
    maxLength: FEEDBACK_ANSWER_MAX_LENGTH,
    isSaving: answer.isPending,
    onTextChange: (event) => {
      setText(event.target.value);
    },
    onSubmit: () => {
      close(text.trim() === "");
    },
    onDismiss: () => {
      close(true);
    }
  };
};
