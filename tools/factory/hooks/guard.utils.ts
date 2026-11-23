/*
 * The rules agents cannot break, whatever they are told: decided from the
 * tool call alone, before it runs (the PreToolUse hook). Ported from the
 * Dreamdata factory's guard and made generic through factory.config.ts.
 *
 * These are tripwires against mistakes and careless commands, not a sandbox:
 * a command built from variables, or a file read through a shell variable,
 * is not resolved here.
 */
import { isAbsolute, resolve } from "node:path";

export interface IGuardPolicy {
  readonly protectedBranches: readonly string[];
  readonly secretFilePattern: RegExp;
  readonly forbiddenPrograms: readonly string[];
  readonly forbiddenSubcommands: Readonly<Record<string, readonly string[]>>;
  readonly serviceContainerPattern: RegExp;
}

export type Decision = { allow: true } | { allow: false; reason: string };

/** The git checkout a command runs in. */
export interface ICheckout {
  readonly branch: string;
  /** A checkout several sessions or stacks run from: its branch must not move. */
  readonly shared: boolean;
}

export interface IGuardContext {
  /** The folder the tool call runs in. */
  readonly cwd: string;
  /** The person's home folder, for `~`. */
  readonly home: string;
  readonly checkout: (dir: string) => ICheckout;
  readonly policy: IGuardPolicy;
}

const ALLOW: Decision = { allow: true };

const deny = (reason: string): Decision => ({ allow: false, reason });

const firstDeny = (decisions: readonly Decision[]): Decision =>
  decisions.find((decision) => !decision.allow) ?? ALLOW;

/** A glob that can match dotfiles (`.env*`, `.*`), so it may name a secret. */
const DOTFILE_GLOB = /(^|[\s/=])\.[^\s/'"]*[*?[]/u;

/** The text with its quoted parts emptied: what the shell sees as words and operators. */
const unquoted = (text: string): string =>
  text.replaceAll(/"(?:[^"\\]|\\.)*"|'[^']*'/gu, '""');

/** A dotfile glob the shell expands (`cat .env*`); quoted, it is a pattern, not files. */
const expandsDotfileGlob = (text: string): boolean =>
  DOTFILE_GLOB.test(unquoted(text));

interface IPiece {
  text: string;
  /** Joined to the piece before it by `|`: it reads that piece's output. */
  piped: boolean;
}

interface ISplitState {
  pieces: IPiece[];
  current: string;
  piped: boolean;
  quote: string | undefined;
}

/** Inside quotes: copy the character, honour `\"`, and close on the quote. Returns chars consumed. */
const quotedStep = (state: ISplitState, char: string, next: string): number => {
  state.current += char;

  if (char === "\\" && state.quote === '"') {
    state.current += next;

    return 2;
  }

  if (char === state.quote) {
    state.quote = undefined;
  }

  return 1;
};

const flush = (state: ISplitState): void => {
  if (state.current.trim() !== "") {
    state.pieces.push({ text: state.current, piped: state.piped });
  }

  state.current = "";
};

/** Splits at `;`, `&&`, `||`, `&`, `|` and newlines outside quotes. */
const piecesOf = (command: string): IPiece[] => {
  const state: ISplitState = {
    pieces: [],
    current: "",
    piped: false,
    quote: undefined,
  };
  let index = 0;

  while (index < command.length) {
    const char = command.charAt(index);
    const next = command.charAt(index + 1);

    if (state.quote !== undefined) {
      index += quotedStep(state, char, next);
    } else if (char === '"' || char === "'") {
      state.quote = char;
      state.current += char;
      index += 1;
    } else if (";\n&|".includes(char)) {
      flush(state);
      state.piped = char === "|" && next !== "|";
      index += (char === "&" || char === "|") && next === char ? 2 : 1;
    } else {
      state.current += char;
      index += 1;
    }
  }

  flush(state);

  return state.pieces;
};

/** A piece of a command and the folder it runs in (undefined: a variable decides). */
interface ISegment {
  text: string;
  dir: string | undefined;
}

const CD = /^[\s({]*cd\s+("[^"]*"|'[^']*'|[^\s)}]+)/u;
const GIT_C = /\bgit\s+-C\s+("[^"]*"|'[^']*'|[^\s)}]+)/u;
const UNKNOWN_DIR = /[$`]/u;

const resolveDir = (
  base: string | undefined,
  raw: string,
  home: string
): string | undefined => {
  const target = raw.replaceAll(/^["']|["']$/gu, "");

  if (UNKNOWN_DIR.test(target)) {
    return undefined;
  }

  const expanded = target.replace(/^~(?=\/|$)/u, home);

  if (isAbsolute(expanded)) {
    return expanded;
  }

  return base === undefined ? undefined : resolve(base, expanded);
};

/** Each segment with its folder: `cd` moves the ones after it, `git -C` only its own. */
const segmentsOf = (command: string, cwd: string, home: string): ISegment[] => {
  let dir: string | undefined = cwd;

  return command.split(/[;&|\n]+/u).map((text) => {
    const cd = CD.exec(text)?.[1];

    if (cd !== undefined) {
      dir = resolveDir(dir, cd, home);
    }

    const gitDir = GIT_C.exec(text)?.[1];

    return {
      text,
      dir: gitDir === undefined ? dir : resolveDir(dir, gitDir, home),
    };
  });
};

/** `git` that moves a checkout's branch (not `git checkout -- <file>`). */
const switchesBranch = (text: string): boolean =>
  /\bgit\b.*\bswitch\b/u.test(text) ||
  (/\bgit\b.*\bcheckout\b/u.test(text) && !/\s--(\s|$)/u.test(text));

/** `git push` as the subcommand (not a `--grep push` or a message). */
/* Unambiguous on purpose: each option parses one way, so no input backtracks. */
const PUSH =
  /\bgit\b(?:\s+(?:-[Cc]\s+(?:"[^"]*"|'[^']*'|[^\s"']\S*)|--?(?![Cc](?:\s|$))[\w-]+(?:=\S+)?))*\s+push\b(.*)$/u;

/** Refspec names that mean "the branch checked out here". */
const SAME_BRANCH_REFS: ReadonlySet<string> = new Set(["HEAD", "@"]);

const pushTarget = (refspec: string, branch: string): string => {
  const colon = refspec.lastIndexOf(":");
  const source = colon >= 0 ? refspec.slice(0, colon) : refspec;
  const destination = colon >= 0 ? refspec.slice(colon + 1) : refspec;
  const name = destination === "" ? source : destination;

  return SAME_BRANCH_REFS.has(name)
    ? branch
    : name.replace(/^refs\/heads\//u, "");
};

/** Force pushes, pushes of every branch, and pushes to a protected branch. */
const pushRule = (
  text: string,
  checkout: ICheckout,
  policy: IGuardPolicy
): Decision => {
  const rest = PUSH.exec(text)?.[1];

  if (rest === undefined) {
    return ALLOW;
  }

  if (/(\s|^)(--force(-with-lease)?|-f)(\s|=|$)|\s\+\S+/u.test(text)) {
    return deny("force push is never allowed; push a new commit instead");
  }

  const args = rest.split(/[\s()"']+/u).filter((word) => word !== "");
  const everyBranch = args.find((arg) => arg === "--all" || arg === "--mirror");

  if (everyBranch !== undefined) {
    return deny(
      `${everyBranch} pushes every branch, protected ones included; name the branch to push`
    );
  }

  const isProtected = (name: string): boolean =>
    policy.protectedBranches.includes(name);
  const targets = args
    .filter((arg) => !arg.startsWith("-"))
    .slice(1)
    .map((refspec) => pushTarget(refspec, checkout.branch));
  const pushesProtected =
    targets.length > 0
      ? targets.some(isProtected)
      : isProtected(checkout.branch);

  return pushesProtected
    ? deny(
        `pushing to ${policy.protectedBranches.join("/")} is never allowed; push a feature branch and open a pull request (bun run factory pr <branch>)`
      )
    : ALLOW;
};

const sharedCheckoutRule = (text: string, shared: boolean): Decision =>
  shared && switchesBranch(text)
    ? deny(
        "this checkout is shared by other sessions and the stacks started from it; switching its branch changes code someone else runs. Make your own workspace: bun run factory workspace new <issue>"
      )
    : ALLOW;

/** Git pushes and branch switches, judged in the checkout they run in. */
const gitRule = (segment: ISegment, context: IGuardContext): Decision => {
  if (segment.dir === undefined) {
    return /\bgit\b.*\b(push|switch|checkout)\b/u.test(segment.text)
      ? deny(
          "cannot tell which checkout this git command runs in (its folder comes from a variable or a substitution); cd to a plain folder first"
        )
      : ALLOW;
  }

  if (!(PUSH.test(segment.text) || switchesBranch(segment.text))) {
    return ALLOW;
  }

  const found = context.checkout(segment.dir);

  return firstDeny([
    sharedCheckoutRule(segment.text, found.shared),
    pushRule(segment.text, found, context.policy),
  ]);
};

/** Words that run the command after them: `sudo kubectl`, `xargs kubectl`. */
const WRAPPERS = new Set([
  "sudo",
  "env",
  "time",
  "exec",
  "nohup",
  "command",
  "xargs",
  "watch",
  "nice",
  "timeout",
]);
const SHELLS = new Set(["bash", "sh", "zsh"]);

/** The words a piece runs, past assignments, wrappers and their options. */
const runWords = (piece: string): string[] => {
  const words = piece.trim().split(/\s+/u);
  const index = words.findIndex(
    (word) =>
      !/^\w+=/u.test(word) &&
      !WRAPPERS.has(word) &&
      !word.startsWith("-") &&
      !/^\d+[smh]?$/u.test(word)
  );

  return index < 0
    ? []
    : words
        .slice(index)
        .map((word) => word.replaceAll(/^["'({]+|["')}]+$/gu, ""));
};

const programName = (word: string): string => word.split("/").at(-1) ?? word;

/**
 * Whether the command runs `program` (optionally with one of `subcommands`)
 * as a command, not as a word in an argument or a message. `bash -c "…"` is
 * looked into.
 */
const invokes = (
  command: string,
  program: string,
  subcommands?: readonly string[]
): boolean =>
  command.split(/[;&|\n`]+|\$\(|\(/u).some((piece) => {
    const inner =
      /^\s*(?:[A-Za-z_]\w*=\S*\s+)*(\S+)\s+-c\s+(["'])([\s\S]*)\2?\s*$/u.exec(
        piece
      );

    if (inner?.[1] !== undefined && SHELLS.has(inner[1])) {
      return invokes(inner[3] ?? "", program, subcommands);
    }

    const words = runWords(piece);
    const first = words[0];

    return (
      first !== undefined &&
      programName(first) === program &&
      (subcommands === undefined ||
        words.slice(1).some((word) => subcommands.includes(word)))
    );
  });

/** Programs that reach real infrastructure, and infrastructure-changing subcommands. */
const infrastructureRule = (
  command: string,
  policy: IGuardPolicy
): Decision => {
  const program = policy.forbiddenPrograms.find((name) =>
    invokes(command, name)
  );

  if (program !== undefined) {
    return deny(
      `${program} reaches real infrastructure; agents never run it. Ask a person (docs/FOR_OWNER.md)`
    );
  }

  const changing = Object.entries(policy.forbiddenSubcommands).find(
    ([name, subcommands]) => invokes(command, name, subcommands)
  );

  return changing === undefined
    ? ALLOW
    : deny(
        `${changing[0]} ${changing[1].join("/")} changes real infrastructure; agents may plan, never apply. Ask a person (docs/FOR_OWNER.md)`
      );
};

/**
 * Text that is written, not run: commit messages and PR or issue titles and
 * bodies may name a secrets file without reading it. A double-quoted value
 * with `$` or a backtick does run, so it stays.
 */
const withoutMessages = (command: string): string =>
  command.replaceAll(
    /\s(-m|--message|--title|--body)(\s+|=)("(?:[^"\\]|\\.)*"|'[^']*')/gu,
    (match: string, flag: string, _separator: string, value: string) =>
      value.startsWith('"') && /[$`]/u.test(value) ? match : ` ${flag} MESSAGE`
  );

/** A heredoc's body is text written somewhere, not a command that runs. */
const withoutHeredocs = (command: string): string =>
  command.replaceAll(
    /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\s|$)/gu,
    "<<HEREDOC"
  );

/** The command a segment runs: its first word after shell keywords and assignments. */
const commandWord = (text: string): string => {
  const words = text
    .trim()
    .split(/\s+/u)
    .filter((word) => word !== "");
  let index = 0;

  while (
    index < words.length &&
    /^(\(|\{|!|then|do|else|if|while|until|time|[A-Za-z_]\w*=.*)$/u.test(
      words[index] ?? ""
    )
  ) {
    index += 1;
  }

  return (words[index] ?? "").replace(/^[({]+/u, "");
};

/** Commands that only list or describe a file, never print its contents. */
const NAMES_ONLY = new Set([
  "ls",
  "test",
  "[",
  "stat",
  "wc",
  "du",
  "file",
  "echo",
  "printf",
]);

/** Commands that may be a pipe stage of a command that names a secrets file. */
const PIPE_STAGE = new Set([
  ...NAMES_ONLY,
  "cut",
  "sort",
  "uniq",
  "tr",
  "cd",
  "true",
  "false",
]);

/** `cut -d= -f1 <file>`: the key names of a KEY=value file, never the values. */
const KEY_NAMES = /^\s*cut\s+-d\s*['"]?=['"]?\s+-f\s*1(?:\s+[^\s-]\S*)*\s*$/u;

const SECRET_MESSAGE =
  "secrets files are never printed; a command that names one may only list it, or read key names with: cut -d= -f1 <file>";

/** Reading a secrets file: a command naming one may only list it. */
const secretsRule = (fullCommand: string, policy: IGuardPolicy): Decision => {
  const command = withoutHeredocs(withoutMessages(fullCommand));
  const names = (text: string): boolean =>
    policy.secretFilePattern.test(` ${text}`) || expandsDotfileGlob(text);

  if (!names(command)) {
    return ALLOW;
  }

  if (/\$\(|`|\bxargs\b|<(?!<)/u.test(command)) {
    return deny(SECRET_MESSAGE);
  }

  const pipelines: IPiece[][] = [];

  for (const piece of piecesOf(command)) {
    const last = pipelines.at(-1);

    if (piece.piped && last !== undefined) {
      last.push(piece);
    } else {
      pipelines.push([piece]);
    }
  }

  const failing = pipelines
    .filter((pipeline) => pipeline.some((piece) => names(piece.text)))
    .flat()
    .find(({ text }) => {
      const word = commandWord(text);

      return names(text)
        ? !(NAMES_ONLY.has(word) || (word === "cut" && KEY_NAMES.test(text)))
        : !PIPE_STAGE.has(word);
    });

  return failing === undefined ? ALLOW : deny(SECRET_MESSAGE);
};

/** Programs that run checks or package scripts. */
const CHECK_COMMANDS = new Set([
  "npm",
  "npx",
  "pnpm",
  "yarn",
  "bun",
  "bunx",
  "node",
  "tsc",
  "tsx",
  "vitest",
  "eslint",
  "prettier",
  "playwright",
]);

/** `docker exec` / `compose exec` options that take a value. */
const EXEC_VALUE_OPTIONS = new Set([
  "-e",
  "--env",
  "--env-file",
  "-w",
  "--workdir",
  "-u",
  "--user",
  "--index",
]);

/** The words of a command, quote-aware, with their quotes taken off. */
const wordsOf = (text: string): string[] =>
  (text.match(/"(?:[^"\\]|\\.)*"|'[^']*'|\S+/gu) ?? []).map((word) =>
    word.replace(/^(["'])([\s\S]*)\1$/u, "$2")
  );

/** The programs a container command starts, looking into `sh -c "<script>"`. */
const programsOf = (words: readonly string[]): string[] => {
  const program = commandWord(words.join(" "));
  const index = words.indexOf(program);
  const script =
    /^(sh|bash|ash|zsh|dash)$/u.test(programName(program)) &&
    words[index + 1] === "-c"
      ? words[index + 2]
      : undefined;

  return [
    program,
    ...(script === undefined
      ? []
      : piecesOf(script).flatMap((piece) => programsOf(wordsOf(piece.text)))),
  ];
};

/** The container an `exec` names and the words it runs, past exec's options. */
const execTarget = (
  words: readonly string[]
): { container: string; runs: string[] } | undefined => {
  const exec = words.indexOf("exec");

  if (
    exec < 0 ||
    !/\b(docker|compose)\b/u.test(words.slice(0, exec).join(" "))
  ) {
    return undefined;
  }

  let index = exec + 1;

  while (index < words.length && (words[index] ?? "").startsWith("-")) {
    index += EXEC_VALUE_OPTIONS.has(words[index] ?? "") ? 2 : 1;
  }

  return { container: words[index] ?? "", runs: words.slice(index + 1) };
};

/** Checks and package scripts inside a running dev container. */
const serviceContainerRule = (
  fullCommand: string,
  policy: IGuardPolicy
): Decision => {
  const command = withoutHeredocs(withoutMessages(fullCommand));
  const advice =
    "checks and package scripts never run inside a running dev container; use bun run factory verify (an owned sandbox) or run them on the host";

  for (const { text } of piecesOf(command)) {
    const target = execTarget(wordsOf(text));

    if (
      target === undefined ||
      !policy.serviceContainerPattern.test(target.container)
    ) {
      continue;
    }

    if (/\$\(|`/u.test(target.runs.join(" "))) {
      return deny(advice);
    }

    if (
      programsOf(target.runs).some(
        (program) =>
          CHECK_COMMANDS.has(programName(program)) ||
          program.includes("node_modules/.bin")
      )
    ) {
      return deny(advice);
    }
  }

  return ALLOW;
};

/** A Bash command, each git push or branch switch judged in its own checkout. */
export const checkBash = (command: string, context: IGuardContext): Decision =>
  firstDeny([
    ...segmentsOf(
      withoutHeredocs(withoutMessages(command)),
      context.cwd,
      context.home
    ).map((segment) => gitRule(segment, context)),
    infrastructureRule(command, context.policy),
    secretsRule(command, context.policy),
    serviceContainerRule(command, context.policy),
  ]);

/** The Read tool on a secrets file. */
export const checkRead = (filePath: string, policy: IGuardPolicy): Decision =>
  policy.secretFilePattern.test(` ${filePath}`)
    ? deny("secrets files are never read into the conversation")
    : ALLOW;

/**
 * The Grep and Glob tools: the folder and the file glob must not reach a
 * secrets file. Grep's `pattern` is a regex over contents, not a path.
 */
export const checkSearch = (
  tool: "Grep" | "Glob",
  input: Readonly<Record<string, unknown>>,
  policy: IGuardPolicy
): Decision => {
  const globKey = tool === "Grep" ? "glob" : "pattern";

  return firstDeny(
    ["path", globKey].flatMap((key) => {
      const value = input[key];

      if (typeof value !== "string") {
        return [ALLOW];
      }

      return [
        checkRead(value, policy),
        DOTFILE_GLOB.test(` ${value}`) && key === globKey
          ? deny("secrets files are never read into the conversation")
          : ALLOW,
      ];
    })
  );
};
