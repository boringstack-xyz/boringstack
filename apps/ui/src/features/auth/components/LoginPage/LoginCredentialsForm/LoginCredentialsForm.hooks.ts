import { useMemo } from "react";

import type { ILoginCredentialsFormProps } from "./LoginCredentialsForm.types";

interface ILoginCredentialsFormView {
  readonly hasOAuthProviders: boolean;
}

/**
 * Pure derivations from the props the parent (`LoginPage`) hands us.
 * Lives in its own hook file so the component-folder-structure rule
 * stays satisfied — there is no async state here, just memoization.
 */
export function useLoginCredentialsForm(
  props: Pick<ILoginCredentialsFormProps, "oauthProviders">
): ILoginCredentialsFormView {
  const hasOAuthProviders = useMemo(
    () => props.oauthProviders.length > 0,
    [props.oauthProviders]
  );

  return { hasOAuthProviders };
}
