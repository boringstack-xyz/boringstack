import { buildAIProvider } from "./provider-factory.utils";
import type { IAIProvider } from "./types";

export const aiProvider: IAIProvider = buildAIProvider();
