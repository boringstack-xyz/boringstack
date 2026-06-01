import { loadEnv } from "./env.loader";
import type { IEnv } from "./env.types";

export const env: IEnv = loadEnv();
export type { IEnv } from "./env.types";
