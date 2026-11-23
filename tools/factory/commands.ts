import { browseCommands } from "./browse";
import type { IFactoryCommand } from "./command.types";
import { fleetCommands } from "./fleet";
import { hookCommands } from "./hooks";
import { lanesCommands } from "./lanes";
import { recordCommands } from "./record";
import { trackerCommands } from "./tracker";
import { workspaceCommands } from "./workspace";

/* The whole CLI. Each area owns its list in <area>/index.ts. */
export const COMMANDS: readonly IFactoryCommand[] = [
  ...workspaceCommands,
  ...recordCommands,
  ...hookCommands,
  ...trackerCommands,
  ...fleetCommands,
  ...browseCommands,
  ...lanesCommands,
];

/** The command whose name is the longest prefix of argv, and the rest of argv. */
export const resolveCommand = (
  argv: readonly string[],
  commands: readonly IFactoryCommand[] = COMMANDS
): { command: IFactoryCommand; args: string[] } | undefined => {
  const match = [...commands]
    .sort((left, right) => right.name.length - left.name.length)
    .find((command) => {
      const words = command.name.split(" ");

      return words.every((word, index) => argv[index] === word);
    });

  return match === undefined
    ? undefined
    : { command: match, args: argv.slice(match.name.split(" ").length) };
};
