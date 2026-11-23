import { COMMANDS, resolveCommand } from "./commands";
import { createContext } from "./context";
import { blocked, EXIT, type ICommandOutcome } from "./result";

/*
 * `bun run factory <command> [args] [--json]`. Exit 0 done, 1 failed,
 * 2 blocked. Human output is one plain line; --json prints the outcome.
 */
const argv = process.argv.slice(2).filter((arg) => arg !== "--");
const json = argv.includes("--json");
const words = argv.filter((arg) => arg !== "--json");

const help = (): string =>
  [
    "bun run factory <command> [--json]",
    "",
    ...COMMANDS.map(
      (command) =>
        `  ${[command.name, command.usage ?? ""].join(" ").trim().padEnd(44)} ${command.summary}`
    ),
  ].join("\n");

const run = async (): Promise<ICommandOutcome> => {
  if (words.length === 0 || words[0] === "help") {
    console.log(help());

    return { code: EXIT.ok, summary: "help" };
  }

  const resolved = resolveCommand(words);

  return resolved === undefined
    ? blocked(`unknown command: ${words.join(" ")} (see: bun run factory help)`)
    : resolved.command.run(resolved.args, createContext(json));
};

const outcome = await run();

if (outcome.summary !== "help") {
  console.log(json ? JSON.stringify(outcome) : outcome.summary);
}

process.exitCode = outcome.code;
