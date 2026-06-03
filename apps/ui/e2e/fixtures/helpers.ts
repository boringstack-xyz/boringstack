import { type APIRequestContext, request } from "@playwright/test";
import { z } from "zod";

import { parseBody } from "./parse";

/**
 * API-driven setup helpers shared by the e2e specs. Specs drive the
 * real API for user provisioning so each test stays focused on its UI
 * flow — and every spec uses THIS module instead of a local copy (the
 * canonical-helpers-single-home lint-meta rule enforces it).
 */
export interface ITestUser {
  readonly email: string;
  readonly password: string;
}

export const E2E_API_BASE_URL = "http://localhost:7331";
export const E2E_PASSWORD = "E2EPassword123!";

/** Unique throwaway address; prefix namespaces the owning spec. */
export function uniqueEmail(prefix: string): string {
  return `e2e-${prefix}-${String(Date.now())}-${String(
    Math.floor(Math.random() * 1_000_000)
  )}@e2e.test`;
}

/** Register a user and force-verify them via the test-only endpoint. */
export async function registerAndVerify(
  user: ITestUser,
  firstName = "E2E",
  lastName = "User"
): Promise<void> {
  const ctx: APIRequestContext = await request.newContext({
    baseURL: E2E_API_BASE_URL
  });

  const registerRes = await ctx.post("/api/v1/auth/register", {
    data: {
      email: user.email,
      password: user.password,
      firstName,
      lastName
    }
  });

  if (!registerRes.ok()) {
    throw new Error(
      `register failed (${String(registerRes.status())}): ${await registerRes.text()}`
    );
  }

  const verifyRes = await ctx.post("/api/v1/auth/__test/force-verify", {
    data: { email: user.email }
  });

  if (!verifyRes.ok()) {
    throw new Error(
      `force-verify failed (${String(verifyRes.status())}): ${await verifyRes.text()}`
    );
  }

  await ctx.dispose();
}

/** Fresh APIRequestContext holding a live session for the user. */
export async function authedContext(
  user: ITestUser
): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: E2E_API_BASE_URL });
  const loginRes = await ctx.post("/api/v1/auth/login", {
    data: { email: user.email, password: user.password }
  });

  if (!loginRes.ok()) {
    throw new Error(
      `login failed (${String(loginRes.status())}): ${await loginRes.text()}`
    );
  }

  return ctx;
}

/** The session's active account id from /users/me (schema-parsed). */
export async function fetchActiveAccountId(
  ctx: APIRequestContext
): Promise<string> {
  const meRes = await ctx.get("/api/v1/users/me");

  if (!meRes.ok()) {
    throw new Error(`/me failed (${String(meRes.status())})`);
  }

  const body = await parseBody(
    meRes,
    z.object({ account: z.object({ id: z.string() }) })
  );

  return body.account.id;
}
