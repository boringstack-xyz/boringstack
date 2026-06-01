import type { operations } from "@/lib/api/schema";

export type ICapabilities =
  operations["getApiV1Capabilities"]["responses"][200]["content"]["application/json"];
