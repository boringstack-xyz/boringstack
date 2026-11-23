export interface IPageLoadingProps {
  /** What is loading, e.g. "Opening your project"; "Loading…" by default. */
  readonly title?: string;
  /** Fill the screen, or just the space it is given. */
  readonly fullScreen?: boolean;
}
