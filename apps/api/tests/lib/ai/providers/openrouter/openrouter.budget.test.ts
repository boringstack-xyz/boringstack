import { expect, test } from "bun:test";
import { streamBudget } from "../../../../../src/lib/ai/providers/openrouter/openrouter.budget";
import { requestBody } from "../../../../../src/lib/ai/providers/openrouter/openrouter.utils";

const catalog = {
  data: [
    {
      id: "cheap",
      context_length: 128000,
      pricing: { prompt: "0.0000001", completion: "0.0000004" },
    },
    {
      id: "fallback",
      context_length: 256000,
      pricing: { prompt: "0.0000002", completion: "0.0000008" },
    },
  ],
};

test("reserves the worst context and rates across all candidates and every round", () => {
  const budget = streamBudget(
    catalog,
    ["cheap", "fallback"],
    4096,
    7,
    1_000_000
  );

  expect(budget.reserveUsd).toBeGreaterThanOrEqual(
    (256000 * 0.0000002 + 4096 * 0.0000008) * 7
  );
  expect(budget.reserveUsd).toBeGreaterThan(0.05);
  const body = requestBody(
    {
      models: ["cheap", "fallback"],
      messages: [],
      tools: [],
      maxOutputTokens: 4096,
      signal: new AbortController().signal,
      budget,
    },
    { dataCollection: "deny" }
  );

  /* The reservation guards spending; hosts are not capped by price, so the fastest answers. */
  expect(body.provider).toMatchObject({
    require_parameters: true,
    sort: "throughput",
  });
  expect(body.provider).not.toHaveProperty("max_price");
});

test("reserves a prompt of the input cap, not a 1M-token context", () => {
  const budget = streamBudget(
    {
      data: [
        {
          id: "vision",
          context_length: 1_000_000,
          pricing: { prompt: "0.000002", completion: "0.00001" },
        },
      ],
    },
    ["vision"],
    12_000,
    7,
    100_000
  );

  /* (100k x $2/M + 12k x $10/M) a call, seven calls: about $2.24, not $14.84. */
  expect(budget.reserveUsd).toBeCloseTo(2.24, 2);
});

test("fails closed for missing models, context or pricing", () => {
  expect(() => streamBudget(catalog, ["missing"], 4096, 7, 100_000)).toThrow();
  expect(() =>
    streamBudget(
      { data: [{ id: "bad", context_length: 0, pricing: {} }] },
      ["bad"],
      4096,
      7,
      100_000
    )
  ).toThrow();
  expect(() =>
    streamBudget(
      {
        data: [
          {
            id: "bad",
            context_length: 100,
            pricing: { prompt: "-1", completion: "0" },
          },
        ],
      },
      ["bad"],
      4096,
      7,
      100_000
    )
  ).toThrow();
});
