import { useContext } from "react";

import { AbilityContext } from "./acl.context";
import type { AppAbility } from "./acl.types";

/**
 * Returns the CASL ability for the currently-active membership. Reads
 * from `<AbilityProvider>` at the app root. Before `/me` resolves the
 * returned ability is empty — `can(...)` always returns false — so a
 * privileged button never flashes during the auth round-trip.
 */
export function useCan(): AppAbility {
  return useContext(AbilityContext);
}
