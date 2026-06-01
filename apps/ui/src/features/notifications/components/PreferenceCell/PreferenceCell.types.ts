export interface IPreferenceCellProps {
  readonly eventType: string;
  readonly channel: string;
  readonly enabled: boolean;
  readonly onToggle: (eventType: string, channel: string) => void;
}
