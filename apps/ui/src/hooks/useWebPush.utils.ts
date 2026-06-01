/**
 * Convert a base64url-encoded VAPID public key (as produced by
 * `web-push.generateVAPIDKeys()` on the server) to the `Uint8Array` shape
 * `PushManager.subscribe()` requires.
 *
 * Pure function. Tested in the sibling `.test.ts`.
 */
export function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/gu, "+").replace(/_/gu, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}
