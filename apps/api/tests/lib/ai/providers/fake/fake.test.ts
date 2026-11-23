import { expect, test } from "bun:test";

import { FakeStreamingProvider } from "../../../../../src/lib/ai/providers/fake";

const request = (signal = new AbortController().signal) => ({
  models: ["test/fake-model"],
  messages: [],
  tools: [],
  maxOutputTokens: 10,
  signal,
});

test("replays scripts in order and records requests", async () => {
  const fake = new FakeStreamingProvider();

  fake.enqueue(
    [{ type: "text", delta: "one" }],
    [{ type: "fail", message: "down" }]
  );
  const first: string[] = [];

  for await (const event of fake.stream(request())) {
    first.push(event.type);
  }

  expect(first).toEqual(["text"]);
  const drained = (async () => {
    for await (const _ of fake.stream(request())) {
      // drain
    }
  })().then(
    () => "",
    (error: unknown) => (error instanceof Error ? error.message : "")
  );

  expect(await drained).toBe("down");
  expect(fake.requests).toHaveLength(2);
});

test("a hanging script ends when the turn is aborted", async () => {
  const fake = new FakeStreamingProvider();
  const controller = new AbortController();

  fake.enqueue([{ type: "hang" }, { type: "text", delta: "never" }]);
  setTimeout(() => {
    controller.abort();
  }, 5);
  const seen: string[] = [];

  for await (const event of fake.stream(request(controller.signal))) {
    seen.push(event.type);
  }

  expect(seen).toEqual([]);
});
