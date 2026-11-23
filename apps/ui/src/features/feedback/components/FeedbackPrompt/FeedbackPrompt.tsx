import type { FC } from "react";

import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { FEEDBACK_PROMPT_TEST_IDS } from "./FeedbackPrompt.constants";
import { useFeedbackPrompt } from "./FeedbackPrompt.hooks";
import type { IFeedbackPromptProps } from "./FeedbackPrompt.types";

/*
 * The one-question prompt. A non-modal card, so the page under it stays usable
 * and a robot or a keyboard user is never trapped in it.
 */
const FeedbackPrompt: FC<IFeedbackPromptProps> = (props) => {
  const { t } = useTranslation();
  const view = useFeedbackPrompt(props);

  if (!view.isOpen) {
    return null;
  }

  return (
    <section
      aria-label={t("feedback.prompt.ariaLabel")}
      className='border-border-strong/40 bg-panel fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border p-5 shadow-2xl'
    >
      <label
        htmlFor='feedback-prompt-text'
        className='text-foreground text-sm font-semibold'
      >
        {t("feedback.prompt.question")}
      </label>
      <textarea
        id='feedback-prompt-text'
        data-testid={FEEDBACK_PROMPT_TEST_IDS.textarea}
        value={view.text}
        maxLength={view.maxLength}
        rows={3}
        placeholder={t("feedback.prompt.placeholder")}
        onChange={view.onTextChange}
        className='border-border bg-background text-foreground focus-visible:ring-ring rounded-md border p-2 text-sm focus-visible:ring-2 focus-visible:outline-none'
      />
      <div className='flex justify-end gap-2'>
        <Button
          type='button'
          variant='ghost'
          data-testid={FEEDBACK_PROMPT_TEST_IDS.dismiss}
          disabled={view.isSaving}
          onClick={view.onDismiss}
        >
          {t("feedback.prompt.notNow")}
        </Button>
        <Button
          type='button'
          data-testid={FEEDBACK_PROMPT_TEST_IDS.submit}
          disabled={view.isSaving}
          onClick={view.onSubmit}
        >
          {t("feedback.prompt.send")}
        </Button>
      </div>
    </section>
  );
};

export default FeedbackPrompt;
