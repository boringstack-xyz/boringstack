import {
  CircleAlert,
  CircleCheck,
  FileQuestion,
  Inbox,
  LoaderCircle,
  WifiOff
} from "lucide-react";

import type { EdgeStateKind, IEdgeStateIcon } from "./EdgeState.types";

/* The picture a state wears: the icon that says what kind of state it is, and its tone. */
export function edgeStateIconFor(kind: EdgeStateKind): IEdgeStateIcon {
  const icons: Record<EdgeStateKind, IEdgeStateIcon> = {
    missing: { icon: FileQuestion, tone: "outline" },
    error: { icon: CircleAlert, tone: "danger" },
    empty: { icon: Inbox, tone: "soft" },
    offline: { icon: WifiOff, tone: "danger" },
    loading: { icon: LoaderCircle, tone: "soft" },
    success: { icon: CircleCheck, tone: "outline" }
  };

  return icons[kind];
}
