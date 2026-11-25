#!/usr/bin/env bun
// Pushes the working tree's changes as one signed commit, run by the agent
// lanes and .github/workflows/deps-steward.yml after their agent has worked.
//
//   bun push-signed.mjs [--new] <branch> <message>
//
// --new first creates <branch> on GitHub at the checked-out HEAD (an agent
// lane's fix branch); without it the branch must already exist.
//
// main requires signed commits, and a commit made on the runner is not signed.
// GitHub signs commits it creates through createCommitOnBranch, so the change
// goes up through the API instead of git push. expectedHeadOid is the checked
// out HEAD: when the branch moved meanwhile (Dependabot rebased it), GitHub
// refuses the commit and this exits 3.
import { readFileSync } from "node:fs";

/** `git diff --cached --name-status -z --no-renames` to file changes. */
export function fileChanges(nameStatus, read) {
  const fields = nameStatus.split("\0").filter((field) => field !== "");
  const additions = [];
  const deletions = [];

  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index];
    const path = fields[index + 1];

    if (status === "D") {
      deletions.push({ path });
    } else {
      additions.push({ path, contents: read(path).toString("base64") });
    }
  }

  return { additions, deletions };
}

const MUTATION = `mutation($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) { commit { oid url } }
}`;

const run = (argv, input) => {
  const result = Bun.spawnSync(argv, { stdin: input === undefined ? "ignore" : new TextEncoder().encode(input), stdout: "pipe", stderr: "pipe" });

  return { ok: result.exitCode === 0, out: result.stdout.toString(), err: result.stderr.toString() };
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const createBranch = args.includes("--new");
  const [branch, message] = args.filter((arg) => arg !== "--new");

  if (!branch || !message) {
    console.error("usage: push-signed.mjs [--new] <branch> <message>");
    process.exit(2);
  }

  run(["git", "add", "-A"]);
  const head = run(["git", "rev-parse", "HEAD"]).out.trim();
  const diff = run(["git", "diff", "--cached", "--name-status", "-z", "--no-renames", "HEAD"]).out;
  const changes = fileChanges(diff, (path) => readFileSync(path));

  if (changes.additions.length + changes.deletions.length === 0) {
    console.log("nothing to commit");
    process.exit(0);
  }

  if (createBranch) {
    const created = run([
      "gh", "api", `repos/${process.env.GITHUB_REPOSITORY}/git/refs`,
      "-f", `ref=refs/heads/${branch}`, "-f", `sha=${head}`,
    ]);

    if (!created.ok) {
      console.error(`could not create ${branch}: ${created.err.trim()}`);
      process.exit(3);
    }
  }

  const body = JSON.stringify({
    query: MUTATION,
    variables: {
      input: {
        branch: { repositoryNameWithOwner: process.env.GITHUB_REPOSITORY, branchName: branch },
        message: { headline: message },
        expectedHeadOid: head,
        fileChanges: changes,
      },
    },
  });
  const posted = run(["gh", "api", "graphql", "--input", "-"], body);
  const reply = posted.out === "" ? {} : JSON.parse(posted.out);

  if (!posted.ok || reply.errors) {
    console.error(posted.err, JSON.stringify(reply.errors ?? ""));
    /* The head moved under us: the caller gives the attempt back. */
    process.exit(3);
  }

  console.log(`signed commit ${reply.data.createCommitOnBranch.commit.url}`);
}
