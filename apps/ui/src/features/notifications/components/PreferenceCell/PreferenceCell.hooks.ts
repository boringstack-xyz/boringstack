import { useCallback } from "react";

import type { IPreferenceCellProps } from "./PreferenceCell.types";

export interface IPreferenceCellView {
  readonly handleChange: () => void;
}

export function usePreferenceCell(
  props: IPreferenceCellProps
): IPreferenceCellView {
  const { eventType, channel, onToggle } = props;

  const handleChange = useCallback((): void => {
    onToggle(eventType, channel);
  }, [eventType, channel, onToggle]);

  return { handleChange };
}
