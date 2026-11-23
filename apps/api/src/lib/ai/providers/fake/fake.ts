import { ApiErrors } from "../../../errors";
import type {
  IAIStreamEvent,
  IStreamRequest,
  IStreamingAIProvider,
} from "../../stream.types";

export type FakeStep =
  | IAIStreamEvent
  | { readonly type: "fail"; readonly message: string }
  | { readonly type: "hang" };

/**
 * Scripted provider for tests: each call to `stream` consumes the next
 * script. It never touches the network. `hang` waits for the abort signal,
 * to exercise timeouts and cancellation.
 */
export class FakeStreamingProvider implements IStreamingAIProvider {
  public readonly providerName = "fake" as const;
  public readonly requests: IStreamRequest[] = [];
  private readonly scripts: FakeStep[][] = [];

  public enqueue(...scripts: FakeStep[][]): void {
    this.scripts.push(...scripts);
  }

  public reset(): void {
    this.scripts.length = 0;
    this.requests.length = 0;
  }

  public async *stream(request: IStreamRequest): AsyncIterable<IAIStreamEvent> {
    request.signal.throwIfAborted();
    request.onDispatch?.();
    this.requests.push(request);
    const script = this.scripts.shift() ?? [
      { type: "text", delta: "No scripted reply." },
      {
        type: "usage",
        model: request.models[0] ?? "fake",
        usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
      },
      { type: "finish", reason: "stop" },
    ];

    for (const step of script) {
      if (step.type === "fail") {
        throw ApiErrors.externalService(step.message);
      }

      if (step.type === "hang") {
        await new Promise<void>((resolve) => {
          request.signal.addEventListener("abort", () => {
            resolve();
          });
        });

        return;
      } else {
        yield step;
      }
    }
  }
}
