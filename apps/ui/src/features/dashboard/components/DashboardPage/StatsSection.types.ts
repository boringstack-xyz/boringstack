export interface IStatsSectionProps {
  readonly isLoading: boolean;
  readonly summary: { readonly totalEvents: number } | undefined;
  readonly t: (key: string) => string;
}
