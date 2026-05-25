import type { IPreferenceRow } from "../NotificationsPreferencesPage/NotificationsPreferencesPage.types";

export interface IPreferenceRowProps {
  readonly row: IPreferenceRow;
  readonly channels: readonly string[];
  readonly onToggle: (eventType: string, channel: string) => void;
}

export interface IPreferenceRowCellDescriptor {
  readonly channel: string;
  readonly enabled: boolean;
}

export interface IPreferenceRowView {
  readonly eventType: string;
  readonly cells: readonly IPreferenceRowCellDescriptor[];
  readonly onToggle: IPreferenceRowProps["onToggle"];
}
