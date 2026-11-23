import type { FC } from "react";

import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

import { SUPPORT_BUTTON_TEST_ID } from "./SupportButton.constants";
import { useSupportButton } from "./SupportButton.hooks";
import type { ISupportButtonProps } from "./SupportButton.types";

/*
 * The always-visible way to reach a person: it sits in the top bar, so it
 * never covers the page. On a narrow bar it keeps its icon and drops the words.
 */
const SupportButton: FC<ISupportButtonProps> = ({ className, onOpen }) => {
  const view = useSupportButton({ onOpen });

  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      className={className}
      onClick={view.onOpen}
      aria-label={view.label}
      title={view.label}
      data-testid={SUPPORT_BUTTON_TEST_ID}
    >
      <MessageCircle aria-hidden='true' />
      <span className='hidden sm:inline'>{view.text}</span>
    </Button>
  );
};

SupportButton.displayName = "SupportButton";

export default SupportButton;
export { SupportButton };
