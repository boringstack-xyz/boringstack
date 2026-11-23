import { useTranslation } from "react-i18next";

import type { ISupportButtonProps } from "./SupportButton.types";

/* What the button says and does: its words, its full label and the handler. */
export function useSupportButton(props: Pick<ISupportButtonProps, "onOpen">) {
  const { t } = useTranslation();

  return {
    text: t("support.ask"),
    label: t("support.askLabel"),
    onOpen: props.onOpen
  };
}
