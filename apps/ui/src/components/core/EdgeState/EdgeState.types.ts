import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

import type { IconBadgeTone } from "@/components/core/IconBadge";

/**
 * Which state the screen shows: something missing, something broken,
 * nothing yet, the server out of reach, work under way, or all done.
 */
export type EdgeStateKind =
  "missing" | "error" | "empty" | "offline" | "loading" | "success";

export interface IEdgeStateAction {
  readonly label: string;
  /** A route to go to; when set, the action renders as a link. */
  readonly to?: string;
  readonly onClick?: () => void;
  /** Greyed out while the action is already under way, e.g. retrying. */
  readonly isDisabled?: boolean;
}

export interface IEdgeStateProps {
  readonly kind: EdgeStateKind;
  readonly title: string;
  /** What happened and what to do; a loading state may have none. */
  readonly body?: string;
  readonly action?: IEdgeStateAction;
  readonly secondaryAction?: IEdgeStateAction;
  /** Small eyebrow above the title, e.g. "404". */
  readonly eyebrow?: string;
  readonly testId?: string;
  /** Extra content under the copy, e.g. a template picker. */
  readonly children?: ReactNode;
  /** The page's main heading when the state is the whole page. */
  readonly headingLevel?: 1 | 2;
  /** Compact variant for panels; the default is a full card. */
  readonly size?: "card" | "compact";
}

export interface IEdgeStateIcon {
  readonly icon: LucideIcon;
  readonly tone: IconBadgeTone;
}

export interface IEdgeStateView {
  readonly testId: string;
  readonly role: "alert" | "status" | undefined;
  readonly isBusy: boolean | undefined;
  readonly icon: LucideIcon;
  readonly iconTone: IconBadgeTone;
  readonly sectionClass: string;
  readonly titleClass: string;
  readonly bodyClass: string;
  readonly hasActions: boolean;
}
