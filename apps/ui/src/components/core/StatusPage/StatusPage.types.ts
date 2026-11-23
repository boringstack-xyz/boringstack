import type { IEdgeStateProps } from "../EdgeState";

export interface IStatusPageProps extends Omit<
  IEdgeStateProps,
  "headingLevel" | "size"
> {
  /** The browser tab's title, before the app name. */
  readonly metaTitle: string;
}
