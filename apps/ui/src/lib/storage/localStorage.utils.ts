import { env } from "@/lib/env";

export function namespacedKey(name: string): string {
  return `${env.VITE_AUTH_NAMESPACE}:v1:${name}`;
}
