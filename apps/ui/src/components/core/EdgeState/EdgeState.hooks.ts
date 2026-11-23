import { cn } from "@/lib/classnames";

import { EDGE_STATE_ROLES, EDGE_STATE_TEST_ID } from "./EdgeState.constants";
import type { IEdgeStateProps, IEdgeStateView } from "./EdgeState.types";
import { edgeStateIconFor } from "./EdgeState.utils";

/** Presentation decisions for an edge state: a broken thing is an alert, work under way a status, a card roomier than a panel. */
export function useEdgeState(props: IEdgeStateProps): IEdgeStateView {
  const size = props.size ?? "card";
  const isCard = size === "card";
  const { icon, tone } = edgeStateIconFor(props.kind);

  return {
    testId: props.testId ?? EDGE_STATE_TEST_ID,
    role: EDGE_STATE_ROLES[props.kind],
    isBusy: props.kind === "loading" ? true : undefined,
    icon,
    iconTone: tone,
    sectionClass: cn(
      "isolate flex flex-col items-center text-center",
      isCard &&
        "border-border bg-background gap-5 rounded-lg border px-6 py-12 shadow-sm",
      !isCard && "gap-3 px-4 py-6"
    ),
    titleClass: cn("font-semibold", isCard ? "mt-1 text-xl" : "text-sm"),
    bodyClass: cn("text-muted-foreground mt-2", isCard ? "text-sm" : "text-xs"),
    hasActions:
      props.action !== undefined || props.secondaryAction !== undefined
  };
}
