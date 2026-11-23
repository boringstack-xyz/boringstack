# AI streaming with tools

Read this when a product needs a chat that streams tokens and calls tools,
or when choosing `AI_PROVIDER=openrouter`. Single-shot calls stay on
`aiProvider.chat()` (see `src/lib/ai/types.ts`); streaming is a separate
contract so those callers keep their shape.

## What the template ships

| Piece                                  | Role                                                        |
| -------------------------------------- | ----------------------------------------------------------- |
| `src/lib/ai/stream.types.ts`           | `IStreamingAIProvider`, messages, tools, events, budget     |
| `src/lib/ai/providers/openrouter/`     | Streams `POST /chat/completions` over native fetch          |
| `src/lib/ai/providers/fake/`           | Scripted provider for tests; `hang` exercises abort         |
| `src/lib/ai/stream-provider.ts`        | `buildStreamingProvider(settings)` and the env-bound `streamingProvider` |

The template ships no HTTP route for streaming. A product adds one, and it
must get an entry in `apps/ui/e2e/robot/api-coverage.ts`.

## Enabling it

```bash
AI_ENABLED=true
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=...            # required; without it streaming is off
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_DATA_COLLECTION=deny   # deny | allow; anything else is deny
```

`AI_PROVIDER=openrouter` also makes `aiProvider.chat()` an OpenAI-compatible
client pointed at OpenRouter, so single-shot and streaming calls share one
key. `streamingProvider` is `null` unless `AI_ENABLED=true`,
`AI_PROVIDER=openrouter` and the key is set. Startup and readiness never
depend on OpenRouter being reachable.

## Wiring a product route

1. Check the provider exists: `if (streamingProvider === null)` answers
   "unavailable" (do not throw at boot).
2. Build a turn budget before any paid dispatch. `streamingProvider.quote`
   reads OpenRouter's model catalogue and returns `IStreamBudget`;
   `OpenRouterProvider.stream` refuses a request with no `budget`, so an
   unpriced turn is never sent.
3. Call `stream({ models, messages, tools, maxOutputTokens, signal, budget,
   onDispatch })`. `models` is ordered; OpenRouter falls back down the list.
   Pass a `signal` tied to the client disconnect and a timeout.
4. Consume the events: `text` (append deltas), `tool_call` (whole calls, arguments
   as raw JSON text to validate yourself), `usage` (`costUsd` may be `null`),
   `finish`.
5. Record spend from `onDispatch` onward. Ambiguous network failures after
   dispatch may still be charged.

Images: a `user` message may carry JPEG `images` (`mediaType: "image/jpeg"`,
base64 without prefix). The provider sends them after the text.

## Testing

Use `FakeStreamingProvider` (exported from `src/lib/ai`):

```ts
const fake = new FakeStreamingProvider();
fake.enqueue([{ type: "text", delta: "Hi" }, { type: "finish", reason: "stop" }]);
fake.enqueue([{ type: "hang" }]); // ends when the request signal aborts
fake.enqueue([{ type: "fail", message: "down" }]);
```

`fake.requests` records every request, so tests can assert the budget,
models and messages that were sent.

## Rules that matter

- The key goes only in the `Authorization` header and never in logs.
- A refused or failed upstream response becomes an `ApiErrors.externalService`
  with a generic message; the upstream body is not echoed.
- Malformed or error-bearing stream chunks raise `StreamChunkError`, never
  partial output.
- Pricing or context lookups that fail closed throw; they never guess a price.
