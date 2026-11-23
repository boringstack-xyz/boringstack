import { join } from "node:path";

import type { IFactoryCommand } from "../command.types";
import { blocked, failed, ok } from "../result";
import { dockerUp } from "./compose";
import { runComposePolicy } from "./compose-policy";
import { runtimeOf } from "./runtime";

export const composePolicyCommand: IFactoryCommand = {
  name: "compose-policy",
  summary:
    "Check compose files against the factory policy (pins, limits, health checks)",
  run: (_args, context) => {
    const runtime = runtimeOf(context);

    if (!dockerUp()) {
      return Promise.resolve(
        blocked(
          "Docker is not running; the compose policy renders the stack, so start Docker and run it again"
        )
      );
    }

    const envExample = join(
      runtime.workspace,
      "infra",
      "compose",
      "compose",
      ".env.example"
    );
    const result = runComposePolicy(runtime.workspace, envExample);

    if (result.blocked !== undefined) {
      return Promise.resolve(blocked(result.blocked));
    }

    if (result.problems.length > 0) {
      return Promise.resolve(
        failed(
          [
            `${String(result.problems.length)} compose policy problem(s):`,
            ...result.problems.map((line) => `- ${line}`),
          ].join("\n"),
          { problems: result.problems }
        )
      );
    }

    return Promise.resolve(
      ok("compose policy: every service follows the rules")
    );
  },
};
