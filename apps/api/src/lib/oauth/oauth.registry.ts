import { githubProvider } from "./providers/github";
import { googleProvider } from "./providers/google";
import { linkedinProvider } from "./providers/linkedin";
import type { IOAuthProviderModule, OAuthProvider } from "./oauth.types";

/** Provider-name → provider-module registry. */
export const PROVIDER_MODULES: Record<OAuthProvider, IOAuthProviderModule> = {
  google: googleProvider,
  github: githubProvider,
  linkedin: linkedinProvider,
};
