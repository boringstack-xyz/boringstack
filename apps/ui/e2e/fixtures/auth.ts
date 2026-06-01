import {
  type APIRequestContext,
  test as base,
  request
} from "@playwright/test";
import { randomUUID } from "node:crypto";

import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";

interface ITestUser {
  readonly email: string;
  readonly password: string;
}

/**
 * Shared Playwright fixtures:
 *
 *   - `testUser`: a freshly-registered user via the API. Worker-scoped so
 *     every test in a worker shares one account, keeping the suite fast. The
 *     email carries a per-worker UUID so parallel workers + re-runs can never
 *     collide on the unique-email index.
 *   - `login` / `dashboard`: page objects on a clean unauthenticated session.
 *   - `authedPage`: a logged-in page that has landed on /dashboard.
 *
 * Tests that explicitly assert against bad credentials should keep using
 * the default `test` from "@playwright/test" or pass garbage strings; the
 * fixture user is only for happy-path auth.
 */
/*
 * Cookie-consent banner sits at fixed bottom-4 z-50 in the real app.
 * In tests we don't want it intercepting clicks on OAuth buttons or
 * footer links, so every fresh page gets a pre-seeded "already
 * configured" entry in localStorage before the React app boots. Keys
 * + shape mirror the persist middleware in
 * apps/ui/src/features/consent/CookieConsent.store.ts; the schema is
 * versioned (`.v1`) so an intentional re-prompt later won't break this.
 */
const CONSENT_STORAGE_KEY = "bs.cookie-consent.v1";
const CONSENT_DISMISSED_STATE = {
  state: {
    status: "configured",
    categories: { essential: true, analytics: false, marketing: false },
    configuredAt: "2026-01-01T00:00:00.000Z"
  },
  version: 0
};

export const test = base.extend<
  {
    login: LoginPage;
    dashboard: DashboardPage;
    authedPage: { login: LoginPage; dashboard: DashboardPage };
  },
  { testUser: ITestUser }
>({
  page: async ({ page }, use) => {
    await page.addInitScript(
      ({ key, value }: { key: string; value: string }) => {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // localStorage can be unavailable in restricted contexts; ignore.
        }
      },
      {
        key: CONSENT_STORAGE_KEY,
        value: JSON.stringify(CONSENT_DISMISSED_STATE)
      }
    );

    await use(page);
  },
  testUser: [
    async ({}, use, workerInfo) => {
      const baseURL = "http://localhost:7331";
      const user: ITestUser = {
        email: `e2e-${String(workerInfo.workerIndex)}-${randomUUID()}@e2e.test`,
        password: "E2EPassword123!"
      };

      const ctx: APIRequestContext = await request.newContext({ baseURL });

      const registerRes = await ctx.post("/api/v1/auth/register", {
        data: {
          email: user.email,
          password: user.password,
          firstName: "E2E",
          lastName: "User"
        }
      });

      if (!registerRes.ok()) {
        const body = await registerRes.text();

        throw new Error(
          `Failed to register e2e test user (HTTP ${String(registerRes.status())}): ${body}`
        );
      }

      /*
       * `/register` writes a pending user; the account is provisioned at
       * verify-email time. `/__test/force-verify` hits that same
       * provisioning convergence point, so the fixture stays
       * deterministic without an email round-trip. The endpoint is gated
       * to `NODE_ENV === "test"` OR `E2E_TEST_ENDPOINTS_ENABLED=true`;
       * the docker-compose dev stack sets the latter so this works
       * against a development-mode API.
       */
      const verifyRes = await ctx.post("/api/v1/auth/__test/force-verify", {
        data: { email: user.email }
      });

      if (!verifyRes.ok()) {
        const body = await verifyRes.text();

        throw new Error(
          `Failed to force-verify e2e test user (HTTP ${String(verifyRes.status())}): ${body}`
        );
      }

      await ctx.dispose();

      await use(user);
    },
    { scope: "worker" }
  ],
  login: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboard: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  authedPage: async ({ page, testUser }, use) => {
    const login = new LoginPage(page);
    const dashboard = new DashboardPage(page);

    await login.goto();
    await login.loginAs(testUser.email, testUser.password);
    await page.waitForURL(/\/dashboard/);
    await use({ login, dashboard });
  }
});

export { expect } from "@playwright/test";
