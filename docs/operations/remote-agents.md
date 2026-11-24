# Remote agents

The factory can run an agent somewhere other than your laptop, keep it running
while you are away, and steer it from a phone or another computer. This page
lists the three routes this repository supports, what each one needs, and what
is not confirmed.

`bun run factory remote` prints the same options with this checkout's status:
which secrets and variables are set on the repository and which are missing,
with the exact command for each.

Checked on 2026-11-24 against the official pages linked below. These products
change quickly. Re-check a link before you rely on a limit or a plan name.

## The three tiers

| Tier | Where the agent runs | How you start it and steer it | Needs | State in this repository |
| ---- | -------------------- | ----------------------------- | ----- | ------------------------ |
| **a. Cloud sessions** | Anthropic's cloud virtual machine | claude.ai/code, the Code tab in the Claude app, or `claude --cloud "<task>"` from a checkout | A Claude Pro, Max, Ultra, Team or Enterprise login; GitHub access to the repository | Nothing to install. The repository's own rules (AGENTS.md, hooks, merge-gate) apply to the work. |
| **b. GitHub Actions lanes** | GitHub-hosted runners, or your `CI_RUNNER` | A person runs a workflow (the triage command or the Actions tab), or a pull request event starts review | The `CLAUDE_CODE_OAUTH_TOKEN` secret and `AGENTS_ENABLED=1` | Built: `agent-triage`, `agent-review`, `agent-revise`, `agent-digest`. Off until enabled. |
| **c. Self-hosted always-on host** | A Linux machine you own, with tmux and Claude Code Remote Control | The Claude app or claude.ai/code, to a session that runs on the host | A Linux host you control, and a Claude subscription login on it | A blueprint in `infra/agent-host`, off by default. Not applied anywhere. |

Other agents follow the same shape. OpenAI Codex has cloud tasks that run in
an environment and a GitHub Action (`openai/codex-action`); this repository
does not wire them. See [Other agents](#other-agents).

## Tier a: cloud sessions

What the official docs confirm ([1]):

- You can start a cloud session from claude.ai/code, from the Code tab in the
  Claude mobile app, from the Desktop app, or with `claude --cloud "<task>"`.
- The session keeps running after you close the laptop. You can check on it,
  and steer it, from any device.
- From a terminal, `claude -p "<message>" --cloud <session-id>` sends a follow-up
  to a running session.
- The session clones the repository from GitHub. GitHub access comes from the
  Claude GitHub App or from `/web-setup`, which sends your local `gh` token to
  your Claude account.
- The default environment has limited network access. Package registries and
  common development hosts are on the default allowlist.
- Cloud sessions are not available to organizations with Zero Data Retention,
  HIPAA, or customer-managed keys, or when Claude Code runs on a third-party
  provider.

What this repository does with it:

- The session works inside a checkout of this repository, so `AGENTS.md`, the
  `.claude/settings.json` hooks (the guard and the Stop gate) and the skills are
  the rules it follows. The official docs say a single-repository session reads
  the repository's `.claude/settings.json` ([1]).
- Merging is still a person's job. `merge-gate` is the only required check, and
  it runs on every pull request whatever produced it.
- **Not verified:** that the factory's Stop gate and `factory verify` run to a
  pass inside a cloud virtual machine. They expect Bun, the checks' dependencies
  and, for `verify`, an owned Docker sandbox. Until someone has run a cloud
  session end to end, treat its verification record as unverified.

Auto-fix: with the Claude GitHub App installed, a cloud session can watch a pull
request and push fixes for failing checks and review comments ([1]). Replies it
posts to review threads appear under your GitHub account, labelled as coming from
Claude Code. The official docs warn that comment-triggered automation, such as
deploy workflows, can run when Claude replies. Review your workflows before you
turn auto-fix on.

Scheduled tasks ([4]) are a separate, research-preview feature. A task runs in the
cloud on a schedule (hourly at the shortest interval), on an API call, or on a
GitHub event. They are available on Pro, Max, Ultra, Team and Enterprise plans and
created at claude.ai/code/routines or with `/schedule`. Runs count against your
account, and anything a task does through your GitHub identity appears as you.

## Tier b: GitHub Actions lanes

The repository's agent workflows ([agent-triage](https://github.com/boringstack-xyz/boringstack/blob/main/.github/workflows/agent-triage.yml),
agent-review, agent-revise, agent-digest) use the Claude Code GitHub Action
`anthropics/claude-code-action` ([3], [7]). The action authenticates with a
repository secret. `CLAUDE_CODE_OAUTH_TOKEN` is the subscription route, and the
official docs say to create it with `claude setup-token` ([3]). An
`ANTHROPIC_API_KEY` secret is the API route.

To turn the lanes on:

1. Create the token on your laptop with `claude setup-token`, then store it with
   `gh secret set CLAUDE_CODE_OAUTH_TOKEN`.
2. Set `gh variable set AGENTS_ENABLED --body 1`. Any other value keeps every
   agent workflow off.

`bun run factory remote` lists which of the two are missing.

### Starting a lane from a phone

Three ways, with different confidence:

- **Comment `@claude` on an issue or pull request.** The official action supports
  this, and it checks that the commenter has write access and rejects bot actors
  by default ([3]). This repository does not ship a workflow that listens for the
  mention. Adding one is a decision for the owner, because it lets anyone with
  write access start an agent run.
- **Run a workflow by hand.** `workflow_dispatch` runs from the Actions tab in a
  browser. **Not confirmed:** whether the GitHub mobile app can start a
  `workflow_dispatch` run. Use the phone's browser to be sure.
- **Triage findings.** `bun tools/factory/cli.ts lanes triage --dispatch` sends
  the next findings from the findings ledger to `agent-triage`. The input is JSON
  made on a laptop, so this route is not for a phone.

Costs: each run uses GitHub Actions minutes and tokens. With a subscription token,
runs draw on the subscription ([3]).

## Tier c: self-hosted always-on host

Claude Code Remote Control ([2]) connects the claude.ai/code session list and the
Claude app to a `claude` process that runs on a machine you control. The official
docs say:

- The process runs on your machine. Execution and file access stay there. The
  machine must stay on and the process must keep running.
- The machine makes outbound HTTPS requests only. It opens no inbound ports.
- It needs a Pro, Max, Ultra, Team or Enterprise login. API keys are not supported.
  On Team and Enterprise, an Owner turns on Remote Control first.
- Server mode is `claude remote-control`, with `--name` and `--spawn`
  (`same-dir`, `worktree` or `session`). The first run asks for confirmation and
  for trust in the directory.
- After the server stops, `--continue` or `--session-id` bring sessions back for
  about four hours.
- Remote Control is not the same as Anthropic's self-hosted environments, which
  run cloud sessions on your own runners. That product is in public beta for Team
  and Enterprise ([5]). This repository does not use it.

Installing Claude Code on Linux: `curl -fsSL https://claude.ai/install.sh | bash`.
The native install updates itself in the background. The npm package needs Node.js
22 or later ([6]).

### What the blueprint sets up

[`infra/agent-host`](https://github.com/boringstack-xyz/boringstack/tree/main/infra/agent-host)
is an OpenTofu module for Hetzner, written like `infra/bootstrap`. It is **off by
default** (`enabled = false`) and it creates nothing until a person sets it and
applies it.

- A server (Ubuntu 24.04) with delete and rebuild protection on.
- A firewall that allows SSH only, from addresses you list. Key-only SSH.
  `ufw` allows SSH only on the host.
- Docker from Docker's own apt repository, with the key fingerprint pinned.
- Bun, pinned to the repository's version (1.4.5), checked against Bun's published
  SHA256 list.
- GitHub CLI, Claude Code (native installer), tmux, and unattended security upgrades.
- A non-root `agent` user that owns the checkout at `~/boringstack`.
- `systemd` timers: `factory sweep` hourly. The fleet page runs as a service on
  `127.0.0.1:8500` only, so you read it through an SSH tunnel.
- `agent-add-person <label>`, which starts a `claude remote-control` session in
  tmux for one person.

### Setting it up, step by step

A person does every step. Agents do not apply the module.

1. Copy `infra/agent-host/terraform.tfvars.example` to `terraform.tfvars` and fill
   in your SSH key and the address you log in from. Put the Hetzner token in
   `TF_VAR_hetzner_api_token`. Never commit either.
2. Review the plan, then apply it from a checkout you control.
3. `ssh root@<ipv4>`. Log in as the agent user with `sudo -u agent -H gh auth login`.
4. Log in to Claude Code once as the agent user: `sudo -u agent -H claude`, then `/login`.
5. Start a person's session: `agent-add-person alice`. Attach once with
   `sudo -u agent tmux attach -t rc-alice` to answer the first-run questions,
   then detach with Ctrl-b, d.
6. On the phone, open the Claude app, go to the Code tab, and open the session
   named `boringstack-alice`.
7. For the fleet page, run `ssh -L 8500:127.0.0.1:8500 root@<ipv4>` and open
   `http://127.0.0.1:8500`.

### Who the sessions belong to

A Remote Control session belongs to the claude.ai account that is signed in on
the host. Every session on one host therefore shows as that account. This is an
inference from the sign-in requirement in [2], and it is why the blueprint takes
one host per person when people have separate accounts. Docker group membership
is root-equivalent on the host, so do not add a person to the `docker` group
unless they are trusted with root.

### What is not verified for tier c

- The module has been validated (`tofu fmt`, `tofu validate`) but never applied.
  Nothing was created on Hetzner.
- The Bun release layout and the `SHASUMS256.txt` file are assumed from Bun's
  release naming. The bootstrap fails closed if they differ, but it has not run.
- The GitHub CLI apt key path and the Docker install follow the same pattern as
  `infra/bootstrap`. They have not run on a host.
- The official setup page describes a browser login. It does not describe the
  login on a headless server over SSH. The step above is therefore a guess until
  someone has done it.
- Whether the factory's Stop gate and `factory verify` pass on the host has not
  been tested.

## Security

- No web port is open to the internet. The fleet page is on `127.0.0.1`.
- SSH is key-only, and the Hetzner firewall and `ufw` both allow SSH only.
- Secrets are not in cloud-init. Logins (`gh`, `claude`) are stored on the host's
  disk, so the host holds the operator's account. Protect it as you would your
  laptop.
- Agents never merge, never push to a protected branch and never run an apply.
  The factory guard refuses those commands, and the merge gate is a required
  check on every pull request.

## Other agents

OpenAI Codex cloud tasks run in an environment that holds the repository, install
and start scripts, secrets and network settings. They can be started from the web
or desktop app and from mobile ([8]). The `openai/codex-action` GitHub Action runs
Codex in a workflow and needs an `OPENAI_API_KEY` secret ([9]). The factory's
hooks currently target Claude Code, and this page does not claim a Codex route
works here.

## Sources

1. Claude Code on the web: https://code.claude.com/docs/en/claude-code-on-the-web
2. Remote Control: https://code.claude.com/docs/en/remote-control
3. Claude Code GitHub Actions: https://code.claude.com/docs/en/github-actions
4. Automate work with scheduled tasks: https://code.claude.com/docs/en/routines
5. Self-hosted environments: https://code.claude.com/docs/en/self-hosted-environments
6. Advanced setup (install): https://code.claude.com/docs/en/setup
7. claude-code-action: https://github.com/anthropics/claude-code-action
8. Codex cloud (redirects to learn.chatgpt.com): https://learn.chatgpt.com/docs/cloud
9. openai/codex-action: https://github.com/openai/codex-action
