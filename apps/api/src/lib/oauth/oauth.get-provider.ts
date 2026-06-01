import type { IOAuthProviderModule, OAuthProvider } from "./oauth.types";
import { PROVIDER_MODULES } from "./oauth.registry";

export function getProvider(provider: OAuthProvider): IOAuthProviderModule {
  return PROVIDER_MODULES[provider];
}
