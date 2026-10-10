export interface IQueryErrorStateProps {
  /** What failed, already translated. */
  readonly message: string;
  /** Translated label for the retry button. */
  readonly retryLabel: string;
  /** Usually the query's `refetch`, wrapped so it returns void. */
  readonly onRetry: () => void;
  /** Disables the button while a retry is in flight. */
  readonly isRetrying?: boolean;
  readonly className?: string;
}
