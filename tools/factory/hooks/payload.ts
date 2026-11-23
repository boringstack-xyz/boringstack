/** What a Claude Code or Codex hook receives on stdin. */
export interface IHookPayload {
  readonly cwd: string | undefined;
  readonly sessionId: string | undefined;
  /** SessionStart: startup, resume, clear or compact. */
  readonly source: string | undefined;
  /** The Stop hook runs again after a block; this is that second Stop. */
  readonly stopHookActive: boolean;
  readonly toolName: string | undefined;
  readonly toolInput: Readonly<Record<string, unknown>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A session id safe as a file name; anything else is no id. */
export const sessionIdOf = (value: unknown): string | undefined =>
  typeof value === "string" && /^[\w-]{1,128}$/u.test(value)
    ? value
    : undefined;

export const parsePayload = (text: string): IHookPayload => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }

  const payload = isRecord(parsed) ? parsed : {};
  const input = payload.tool_input;

  return {
    cwd: typeof payload.cwd === "string" ? payload.cwd : undefined,
    sessionId: sessionIdOf(payload.session_id),
    source: typeof payload.source === "string" ? payload.source : undefined,
    stopHookActive: payload.stop_hook_active === true,
    toolName:
      typeof payload.tool_name === "string" ? payload.tool_name : undefined,
    toolInput: isRecord(input) ? input : {},
  };
};

export const readPayload = async (): Promise<IHookPayload> =>
  parsePayload(await Bun.stdin.text());
