import { emailService } from "../../../lib/email";
import type { IReadinessCheck, IReadinessResult } from "../health.types";

/**
 * Email check is *configuration-only* — we don't probe the provider over
 * the network. Live probes burn provider rate limits, can incur cost, and
 * a flaky 3rd party should not flip our readiness probe (and remove us
 * from the LB) when the API itself is healthy.
 *
 *   noop  → "degraded" with a note (template default; nothing breaks but
 *           outbound email won't actually leave the box)
 *   real  → "ok"
 */
const runEmailCheck = (): Promise<IReadinessResult> => {
  const start = Date.now();

  if (emailService.providerName === "noop") {
    return Promise.resolve({
      name: "email",
      status: "degraded",
      latencyMs: Date.now() - start,
      message: "Email provider is 'noop' — outbound mail is logged, not sent",
    });
  }

  return Promise.resolve({
    name: "email",
    status: "ok",
    latencyMs: Date.now() - start,
  });
};

export const emailCheck: IReadinessCheck = {
  name: "email",
  run: runEmailCheck,
};
