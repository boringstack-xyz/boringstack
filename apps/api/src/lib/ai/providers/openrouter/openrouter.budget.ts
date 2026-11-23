import { ApiErrors } from "../../../errors";
import type { IStreamBudget } from "../../stream.types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const record = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

function price(value: unknown): number {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    value === ""
  ) {
    throw ApiErrors.externalService("Model pricing is unavailable");
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw ApiErrors.externalService("Model pricing is unavailable");
  }

  return amount;
}

/*
 * Reserve, for every round, a whole prompt of `inputTokens` (or the model's
 * advertised context, if smaller) and a whole answer, at the dearest
 * candidate's rates. A model's 1M-token context is far beyond any turn's
 * prompt (history is capped), and reserving it would refuse every turn on a
 * dearer model.
 */
export function streamBudget(
  catalog: unknown,
  models: readonly string[],
  outputTokens: number,
  calls: number,
  inputTokens: number
): IStreamBudget {
  const data = record(catalog).data;

  if (
    !Array.isArray(data) ||
    models.length === 0 ||
    outputTokens <= 0 ||
    calls <= 0 ||
    inputTokens <= 0
  ) {
    throw ApiErrors.externalService("Model pricing is unavailable");
  }

  let context = 0;
  let prompt = 0;
  let completion = 0;

  for (const id of models) {
    const model = record(data.find((item: unknown) => record(item).id === id));
    const length = model.context_length;

    if (
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length <= 0
    ) {
      throw ApiErrors.externalService("Model context limit is unavailable");
    }

    const pricing = record(model.pricing);

    context = Math.max(context, Math.min(length, inputTokens));
    prompt = Math.max(prompt, price(pricing.prompt));
    completion = Math.max(completion, price(pricing.completion));
  }

  const promptPerMillion = Number((prompt * 1e6).toPrecision(12));
  const completionPerMillion = Number((completion * 1e6).toPrecision(12));
  const reserveUsd =
    Math.ceil(
      ((context * promptPerMillion + outputTokens * completionPerMillion) /
        1e6) *
        calls *
        1e6
    ) / 1e6;

  if (!Number.isFinite(reserveUsd)) {
    throw ApiErrors.externalService("Model cost limit is unavailable");
  }

  return { reserveUsd, promptPerMillion, completionPerMillion };
}
