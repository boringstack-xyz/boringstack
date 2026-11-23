import { useMemo } from "react";

import { useTranslation } from "react-i18next";

import type {
  IPreferenceRowProps,
  IPreferenceRowView
} from "./PreferenceRow.types";
import { eventLabelKey } from "./PreferenceRow.utils";

/**
 * Resolves the typed cell descriptor list for a preference row. Lookups
 * against `row.channels` default to `false` so the component never
 * passes `undefined` into the rendered Switch.
 */
export function usePreferenceRow(
  props: IPreferenceRowProps
): IPreferenceRowView {
  const { row, channels, onToggle } = props;
  const { t } = useTranslation();

  return useMemo(
    () => ({
      eventType: row.eventType,
      label: labelFor(row.eventType, t),
      cells: channels.map((channel) => ({
        channel,
        enabled: row.channels[channel] ?? false
      })),
      onToggle
    }),
    [row, channels, onToggle, t]
  );
}

function labelFor(eventType: string, t: (key: string) => string): string {
  const key = eventLabelKey(eventType);

  return key === null ? eventType : t(key);
}
