import { createContextualCan } from "@casl/react";

import { AbilityContext } from "./acl.context";

/**
 * Typed `<Can I="manage" a="Widget">{children}</Can>` over the active
 * membership's ability. Wraps @casl/react's contextual consumer so call
 * sites don't have to thread the ability prop themselves.
 *
 * Render-gating only — the server enforces every action independently.
 */
export const Can = createContextualCan(AbilityContext.Consumer);
