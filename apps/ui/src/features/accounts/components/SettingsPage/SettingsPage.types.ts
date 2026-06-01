import type { SETTINGS_SECTION_KEYS } from "./SettingsPage.constants";

export interface ISettingsPageProps {
  readonly className?: string;
}

export interface ISettingsSectionView {
  readonly id: (typeof SETTINGS_SECTION_KEYS)[number];
  readonly title: string;
  readonly body: string;
}

export interface ISettingsDetailRowView {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

export interface ISettingsDetailRowsProps {
  readonly rows: readonly ISettingsDetailRowView[];
}

export interface IOAuthProviderRow {
  readonly provider: string;
  readonly isLinked: boolean;
}

export interface ISettingsSectionCardProps {
  readonly section: ISettingsSectionView;
  readonly children: React.ReactNode;
}
