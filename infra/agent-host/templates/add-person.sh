#!/usr/bin/env bash
#
# Starts one person's Remote Control session on the agent host, in tmux, as the
# agent user. The person then sees it in the Claude app or at claude.ai/code and
# steers it from a phone or a laptop.
#
# usage (as root): agent-add-person <label>      e.g. agent-add-person alice
#
# Read docs/operations/remote-agents.md first. Facts that matter here:
#   - Remote Control serves the claude.ai account that is logged in on this host.
#     Every session on the host belongs to that one account. For a second
#     person with their own account, use a second host.
#   - The first run asks two questions in the terminal (accept Remote Control,
#     trust the directory). Attach once to answer them, then detach.

set -euo pipefail

CONFIG=/etc/agent-host.env
LABEL="${1:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi

if [[ ! "$LABEL" =~ ^[a-z0-9][a-z0-9-]{1,30}$ ]]; then
  echo "usage: agent-add-person <label>  (lowercase letters, digits, hyphens; 2-31 characters)" >&2
  exit 2
fi

# shellcheck source=/dev/null
source "$CONFIG"

AGENT_HOME="/home/$AGENT_USER"
CLAUDE="$AGENT_HOME/.local/bin/claude"
CHECKOUT="$AGENT_HOME/boringstack"
SESSION="rc-$LABEL"

if [[ ! -x "$CLAUDE" ]]; then
  echo "Claude Code is not installed for $AGENT_USER; run agent-host.sh first" >&2
  exit 1
fi

if sudo -u "$AGENT_USER" -H tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "tmux session $SESSION already runs; attach with: sudo -u $AGENT_USER tmux attach -t $SESSION"
  exit 0
fi

# The window stays open after Remote Control exits, so the error is readable.
sudo -u "$AGENT_USER" -H tmux new-session -d -s "$SESSION" -c "$CHECKOUT" \
  "$CLAUDE remote-control --name 'boringstack-$LABEL' --spawn worktree; echo; echo 'Remote Control stopped. Press Enter to close.'; read -r _"

cat <<EOF
Started $SESSION on this host.

1. Attach once and answer the first-run questions:
     sudo -u $AGENT_USER tmux attach -t $SESSION
   Detach with Ctrl-b then d. The session keeps running.
2. In the Claude app (Code tab) or at claude.ai/code, open the session named
   boringstack-$LABEL. Steer it from there.

If the window says you are not logged in, run once as $AGENT_USER: claude, then /login.
EOF
