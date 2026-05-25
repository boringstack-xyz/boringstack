import type {
  Message,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/messages";

export type AnthropicRole = "user" | "assistant";

export interface IAnthropicMessage {
  role: AnthropicRole;
  content: string;
}

export interface IAnthropicContentBlock {
  type: string;
  text?: string;
}

export interface IAnthropicMessagesClient {
  create: (body: MessageCreateParamsNonStreaming) => Promise<Message>;
}
