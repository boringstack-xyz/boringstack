import type { OAUTH_PROVIDERS } from "./oauth.manifest";

export type IOAuthProvider = (typeof OAUTH_PROVIDERS)[number];
