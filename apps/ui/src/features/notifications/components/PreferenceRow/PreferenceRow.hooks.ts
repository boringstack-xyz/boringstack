import { useMemo } from "react";

import type {
  IPreferenceRowProps,
  IPreferenceRowView
} from "./PreferenceRow.types";

/**
 * Resolves the typed cell descriptor list for a preference row. Lookups
 * against `row.channels` default to `false` so the component never
 * passes `undefined` into the rendered Switch.
 */
export function usePreferenceRow(
  props: IPreferenceRowProps
): IPreferenceRowView {
  const { row, channels, onToggle } = props;

  return useMemo(
    () => ({
      eventType: row.eventType,
      cells: channels.map((channel) => ({
        channel,
        enabled: row.channels[channel] ?? false
      })),
      onToggle
    }),
    [row, channels, onToggle]
  );
}
