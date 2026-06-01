import type { FC, PropsWithChildren } from "react";
import { useMemo } from "react";

import { buildAbility } from "@/lib/acl/ability";
import { AbilityContext, emptyAbility } from "@/lib/acl/acl.context";

import { useMe } from "@/features/auth/Auth.queries";

export const AbilityProvider: FC<PropsWithChildren> = ({ children }) => {
  const me = useMe();

  const ability = useMemo(() => {
    if (!me.data) {
      return emptyAbility;
    }

    return buildAbility(me.data.role, me.data.account.id, me.data.features);
  }, [me.data]);

  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
};
