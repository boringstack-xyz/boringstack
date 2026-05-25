import type { IAIChatOptions, IChatMessage } from "../../types";
import type { IOpenAIMessage } from "./openai.types";

const buildSystemMessage = (
  systemPrompt: string | undefined
): IOpenAIMessage[] =>
  systemPrompt !== undefined && systemPrompt !== ""
    ? [{ role: "system", content: systemPrompt }]
    : [];

const buildHistory = (options: IAIChatOptions): IChatMessage[] => {
  if (options.messages !== undefined) {
    return options.messages;
  }

  if (options.userMessage !== undefined && options.userMessage !== "") {
    return [{ role: "user", content: options.userMessage }];
  }

  return [];
};

export const toOpenAIMessages = (options: IAIChatOptions): IOpenAIMessage[] => [
  ...buildSystemMessage(options.systemPrompt),
  ...buildHistory(options).map<IOpenAIMessage>((message) => ({
    role: message.role,
    content: message.content,
  })),
];
