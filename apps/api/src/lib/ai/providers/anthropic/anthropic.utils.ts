import type { IAIChatOptions, IChatMessage } from "../../types";
import type {
  AnthropicRole,
  IAnthropicContentBlock,
  IAnthropicMessage,
} from "./anthropic.types";

const isAnthropicRole = (role: string): role is AnthropicRole =>
  role === "user" || role === "assistant";

const buildHistory = (options: IAIChatOptions): IChatMessage[] => {
  if (options.messages !== undefined) {
    return options.messages;
  }

  if (options.userMessage !== undefined && options.userMessage !== "") {
    return [{ role: "user", content: options.userMessage }];
  }

  return [];
};

/**
 * Anthropic's Messages API rejects `system` inside the messages array —
 * the system prompt is a top-level field. Drop any non-user/-assistant
 * roles here; the caller passes the system prompt separately.
 */
export const toAnthropicMessages = (
  options: IAIChatOptions
): IAnthropicMessage[] =>
  buildHistory(options)
    .filter((message): message is IChatMessage & { role: AnthropicRole } =>
      isAnthropicRole(message.role)
    )
    .map<IAnthropicMessage>((message) => ({
      role: message.role,
      content: message.content,
    }));

export const extractText = (blocks: IAnthropicContentBlock[]): string =>
  blocks
    .filter((block) => block.type === "text" && block.text !== undefined)
    .map((block) => block.text ?? "")
    .join("");
