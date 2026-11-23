export interface IParsedArgs {
  /** Values of flags that take one value (`--issue demo-1`). */
  readonly values: Record<string, string>;
  /** Switches that were given (`-v`, `--force`). */
  readonly switches: ReadonlySet<string>;
  /** Everything else, in order. */
  readonly rest: readonly string[];
}

/**
 * Splits argv into flags and positional words. A flag that is not listed is an
 * error, so a typo never silently does nothing.
 */
export const parseArgs = (
  args: readonly string[],
  valued: readonly string[],
  switches: readonly string[]
): IParsedArgs | { error: string } => {
  const values: Record<string, string> = {};
  const given = new Set<string>();
  const rest: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";

    if (arg.startsWith("-")) {
      if (valued.includes(arg)) {
        const next = args[index + 1];

        if (next === undefined || next.startsWith("-")) {
          return { error: `${arg} needs a value` };
        }

        values[arg] = next;
        index += 1;
      } else if (switches.includes(arg)) {
        given.add(arg);
      } else {
        return { error: `unknown option ${arg}` };
      }
    } else {
      rest.push(arg);
    }
  }

  return { values, switches: given, rest };
};

export const isParseError = (
  parsed: IParsedArgs | { error: string }
): parsed is { error: string } => "error" in parsed;
