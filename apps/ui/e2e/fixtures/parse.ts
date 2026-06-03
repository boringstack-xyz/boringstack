import type { APIResponse } from "@playwright/test";
import type { z } from "zod";

/**
 * Parse a Playwright `APIResponse` body against a Zod schema.
 *
 * E2e specs assert against real API responses — a bare inline-object
 * cast lets contract drift flow `undefined` into assertions that pass
 * or fail for the wrong reason. Schema-parsing makes drift fail the
 * test loudly at the boundary, with the URL and the mismatch in the
 * error.
 */
export async function parseBody<TSchema extends z.ZodType>(
  response: APIResponse,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  const raw: unknown = await response.json();
  const result = schema.safeParse(raw);

  if (!result.success) {
    throw new Error(
      `API response contract drift at ${response.url()}: ${result.error.message}`
    );
  }

  return result.data;
}
