import { env } from "../../../config/env";
import type { IReadinessCheck, IReadinessResult } from "../health.types";

/**
 * AI check is *configuration-only* — like the email check, we don't probe
 * the provider over the network. Live probes burn credits, can incur cost,
 * and a flaky 3rd party should not flip readiness when the API itself is
 * healthy.
 *
 *   AI_ENABLED=false                            → "ok"   (feature off)
 *   AI_PROVIDER=openai,    no OPENAI_API_KEY    → "down"
 *   AI_PROVIDER=anthropic, no ANTHROPIC_API_KEY → "down"
 *   otherwise                                   → "ok"
 */
const runAICheck = (): Promise<IReadinessResult> => {
  const start = Date.now();
  const latency = (): number => Date.now() - start;

  if (!env.AI_ENABLED) {
    return Promise.resolve({ name: "ai", status: "ok", latencyMs: latency() });
  }

  if (env.AI_PROVIDER === "openai" && env.OPENAI_API_KEY === "") {
    return Promise.resolve({
      name: "ai",
      status: "down",
      latencyMs: latency(),
      message: "AI_PROVIDER=openai but OPENAI_API_KEY is missing",
    });
  }

  if (env.AI_PROVIDER === "anthropic" && env.ANTHROPIC_API_KEY === "") {
    return Promise.resolve({
      name: "ai",
      status: "down",
      latencyMs: latency(),
      message: "AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is missing",
    });
  }

  return Promise.resolve({ name: "ai", status: "ok", latencyMs: latency() });
};

export const aiCheck: IReadinessCheck = {
  name: "ai",
  run: runAICheck,
};
