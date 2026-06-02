import type { ReactNode } from "react";

import type { Action, Subject } from "./acl.types";
import { useCan } from "./useCan";

interface ICanProps {
  /** Action to check, e.g. `"manage"`. */
  readonly I: Action;
  /** Subject to check the action against, e.g. `"Site"`. */
  readonly a: Subject;
  /** Invert the check — render when the ability *denies* the action. */
  readonly not?: boolean;
  /** Render children regardless; only meaningful with a render-prop child. */
  readonly passThrough?: boolean;
  readonly children: ReactNode | ((allowed: boolean) => ReactNode);
}

/**
 * Typed `<Can I="manage" a="Site">{children}</Can>` over the active
 * membership's ability (read from `<AbilityProvider>` via `useCan`).
 *
 * Replaces `@casl/react`'s `createContextualCan`, removed in v7. The rest of
 * the ACL layer keeps its own typed `AbilityContext` + `emptyAbility` default
 * (so a pre-`/me` tree denies everything), so binding `Can` to that context
 * here is all that's needed.
 *
 * Render-gating only — the server enforces every action independently.
 */
export function Can({
  I,
  a,
  not = false,
  passThrough = false,
  children
}: ICanProps): ReactNode {
  const ability = useCan();
  const allowed = not ? ability.cannot(I, a) : ability.can(I, a);

  if (typeof children === "function") {
    return children(allowed);
  }

  return allowed || passThrough ? children : null;
}
