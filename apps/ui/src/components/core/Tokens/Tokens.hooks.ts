import { TOKEN_GROUPS } from "./Tokens.constants";
import type { ITokensView } from "./Tokens.types";

export function useTokens(): ITokensView {
  return { groups: TOKEN_GROUPS };
}
