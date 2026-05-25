import { createContext } from "react";

import { createMongoAbility } from "@casl/ability";

import type { AppAbility } from "./acl.types";

/**
 * Default ability: nothing can be done. Used before /me resolves so a
 * pre-mount component never accidentally renders a privileged button.
 */
export const emptyAbility: AppAbility = createMongoAbility([]);

/**
 * The ability for the currently-active membership. Server is the
 * authority — this context is for UI rendering hints only.
 */
export const AbilityContext = createContext<AppAbility>(emptyAbility);
