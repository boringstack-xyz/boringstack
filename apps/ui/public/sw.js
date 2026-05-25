/*
 * Web Push service worker. Two handlers:
 *
 *   - "push"              Receives an encrypted payload from the browser's
 *                         push service and shows an OS-level notification.
 *                         The payload shape is `{ title, body, url }` —
 *                         same shape the api-template's `web-push.channel`
 *                         emits.
 *   - "notificationclick" Focuses an existing app tab if open, otherwise
 *                         opens a new one at the URL the payload carried.
 *
 * Registered from src/app/main.tsx (gated on `'serviceWorker' in navigator`).
 * No build step — Vite copies `public/sw.js` to the dist root as-is so the
 * scope is `/`, allowing focus/openWindow into any in-app route.
 *
 * URL sanitization: a push payload's `url` field travels through several
 * un-trusted hops (transport, browser push service, our own queue). We
 * therefore treat the payload URL as untrusted input and reduce it to a
 * same-origin `pathname + search + hash` before routing focus / openWindow.
 * A malicious or buggy payload cannot redirect the user off-site.
 *
 * The helpers below are KEPT IN SYNC with the TS twin at
 * `src/lib/web-push/sw-url-sanitize.ts`. The TS twin carries the unit
 * tests (`tests/sw/sw-url-sanitize.test.ts`); this file is a classic
 * worker script (no ES module imports) so the logic has to be inlined.
 */

/**
 * Reduce an inbound payload URL to a safe same-origin app path.
 * Returns "/" when the input is missing, malformed, or off-origin.
 */
function sanitizeTargetPath(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl === "") {
    return "/";
  }

  try {
    const parsed = new URL(rawUrl, self.location.origin);

    if (parsed.origin !== self.location.origin) {
      return "/";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

/** Exact same-origin path/search/hash compare. No substring matching. */
function clientPathMatches(clientUrl, targetPath) {
  try {
    const parsed = new URL(clientUrl);

    if (parsed.origin !== self.location.origin) {
      return false;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}` === targetPath;
  } catch {
    return false;
  }
}

self.addEventListener("push", (event) => {
  let payload = { title: "Notification", body: "", url: null };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch (_err) {
    // Non-JSON payload — fall back to default title/body.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      data: { url: payload.url }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetPath = sanitizeTargetPath(
    event.notification.data && event.notification.data.url
  );

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      for (const client of clientList) {
        if (clientPathMatches(client.url, targetPath)) {
          return client.focus();
        }
      }

      if (clientList.length > 0) {
        const existing = clientList[0];

        if ("navigate" in existing && typeof existing.navigate === "function") {
          await existing.navigate(targetPath);
        }

        return existing.focus();
      }

      return self.clients.openWindow(targetPath);
    })()
  );
});
