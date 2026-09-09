#!/usr/bin/env sh
# BoringStack installer — https://boringstack.xyz/install.sh
#
# Scaffolds a new project from the boringstack-xyz/boringstack template,
# rebrands it, boots the local stack, and verifies it answers on HTTP.
#
#   curl -fsSL https://boringstack.xyz/install.sh | sh -s -- --project acme
#
# Five phases, each announced as [n/5]:
#   1 preflight  docker / ports / memory / git / gh
#   2 scaffold   gh repo create --template, or git clone --depth 1
#   3 rename     scripts/rename-project.sh <project> <ghcr-owner> <domain>
#   4 boot       ./setup.sh --up
#   5 health     poll the UI and the OpenAPI schema until they answer 200
#
# NEVER prompts. `curl ... | sh` leaves no usable stdin, so a prompt is a
# hang for agents and humans alike. Every decision comes from a flag or a
# probe. Human-readable progress goes to stderr; --json puts one JSON
# object per phase on stdout so an agent can parse progress without
# scraping prose.
#
# Exit codes are distinct per phase so a caller knows what broke:
#   2 usage   3 preflight   4 scaffold   5 rename   6 boot   7 health

set -eu

REPO_SLUG="boringstack-xyz/boringstack"
REPO_URL="https://github.com/${REPO_SLUG}"

# Mirrors .tsforge/scaffold-manifest.json: defaultRef, archetypes.boringstack
# (boot + healthUrls), and alwaysOnServices' published ports. check-agent-surface.mjs
# asserts these stay in step with the manifest, so edit both or neither.
DEFAULT_REF="main"
HEALTH_UI="http://localhost:7331/"
HEALTH_API="http://localhost:7330/swagger/json"
CORE_PORTS="7330 7331 5432 6379"

project=""
ghcr_owner=""
domain=""
target_dir=""
ref="$DEFAULT_REF"
do_boot=1
do_rename=1
dry_run=0
force=0
json=0

# ---------------------------------------------------------------- output

# Human chatter goes to stderr so `--json` keeps stdout pure.
say() { printf '%s\n' "$*" >&2; }
warn() { printf 'warning: %s\n' "$*" >&2; }

# die <exit-code> <message> [fix...]
# Every failure names the fix: the reader is usually an agent that will try
# to repair the situation and retry, and it can only do that if told how.
die() {
  code="$1"
  shift
  printf 'error: %s\n' "$1" >&2
  shift
  for line in "$@"; do
    printf '  fix: %s\n' "$line" >&2
  done
  if [ "$json" -eq 1 ]; then
    printf '{"phase":"%s","status":"error","exit":%s}\n' "${current_phase:-unknown}" "$code"
  fi
  exit "$code"
}

current_phase=""
phase() {
  current_phase="$2"
  say ""
  say "[$1/5] $2"
  if [ "$json" -eq 1 ]; then
    printf '{"phase":"%s","step":%s,"status":"start"}\n' "$2" "$1"
  fi
}

phase_ok() {
  if [ "$json" -eq 1 ]; then
    printf '{"phase":"%s","status":"ok"}\n' "$current_phase"
  fi
}

usage() {
  cat >&2 <<'USAGE'
BoringStack installer

Usage:
  curl -fsSL https://boringstack.xyz/install.sh | sh -s -- --project <name> [options]

Required:
  --project <name>        Project name. Lowercase letters, digits and dashes.

Options:
  --ghcr-owner <owner>    GitHub Container Registry owner. Default: <project>
  --domain <domain>       Product domain, used for seeded mailboxes.
                          Default: <project>.com
  --dir <path>            Where to create the project. Default: ./<project>
  --ref <git-ref>         Template ref to start from. Default: main
  --no-rename             Keep the upstream BoringStack identifiers.
  --no-boot               Scaffold and rename only; do not start Docker.
  --force                 Allow a non-empty target directory.
  --json                  Emit one JSON object per phase on stdout.
  --dry-run               Print the resolved plan and exit without writing.
  --yes                   No-op. This installer never prompts.
  -h, --help              Show this message.

Examples:
  # one shot
  curl -fsSL https://boringstack.xyz/install.sh | sh -s -- --project acme

  # full control
  curl -fsSL https://boringstack.xyz/install.sh | sh -s -- \
    --project acme --ghcr-owner acme-corp --domain acme.com

  # scaffold for CI, boot later
  curl -fsSL https://boringstack.xyz/install.sh | sh -s -- --project acme --no-boot

Docs:      https://boringstack.xyz/agents.md
Manifest:  https://boringstack.xyz/scaffold-manifest.json
USAGE
}

# ------------------------------------------------------------------ args

while [ $# -gt 0 ]; do
  case "$1" in
    --project) [ $# -ge 2 ] || die 2 "--project needs a value"; project="$2"; shift 2 ;;
    --project=*) project="${1#*=}"; shift ;;
    --ghcr-owner) [ $# -ge 2 ] || die 2 "--ghcr-owner needs a value"; ghcr_owner="$2"; shift 2 ;;
    --ghcr-owner=*) ghcr_owner="${1#*=}"; shift ;;
    --domain) [ $# -ge 2 ] || die 2 "--domain needs a value"; domain="$2"; shift 2 ;;
    --domain=*) domain="${1#*=}"; shift ;;
    --dir) [ $# -ge 2 ] || die 2 "--dir needs a value"; target_dir="$2"; shift 2 ;;
    --dir=*) target_dir="${1#*=}"; shift ;;
    --ref) [ $# -ge 2 ] || die 2 "--ref needs a value"; ref="$2"; shift 2 ;;
    --ref=*) ref="${1#*=}"; shift ;;
    --no-boot) do_boot=0; shift ;;
    --no-rename) do_rename=0; shift ;;
    --force) force=1; shift ;;
    --json) json=1; shift ;;
    --dry-run) dry_run=1; shift ;;
    # Accepted and discarded: this installer is non-interactive in every
    # mode, so there is no prompt for --yes to skip. Kept because agents and
    # humans reflexively pass it to installers.
    --yes|-y) shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; die 2 "unknown argument: $1" ;;
  esac
done

if [ -z "$project" ]; then
  usage
  die 2 "--project is required" \
    "pass a name, e.g. --project acme"
fi

# rename-project.sh writes these into package names, compose project names,
# container names and image tags. Anything outside this class breaks at least
# one of them, so reject it here rather than halfway through phase 3.
case "$project" in
  *[!a-z0-9-]*)
    die 2 "project name '$project' has characters that are not lowercase letters, digits or dashes" \
      "these become npm package names, Docker container names and GHCR image tags" \
      "try: --project $(printf '%s' "$project" | tr '[:upper:]' '[:lower:]' \
           | tr -c 'a-z0-9-' '-' | tr -s '-' | sed 's/^-//; s/-$//')" ;;
esac
case "$project" in
  -*|*-) die 2 "project name '$project' cannot start or end with a dash" ;;
esac

[ -n "$ghcr_owner" ] || ghcr_owner="$project"
[ -n "$domain" ] || domain="${project}.com"
[ -n "$target_dir" ] || target_dir="./${project}"

# ------------------------------------------------------------------ plan

say "BoringStack installer"
say ""
say "  project      $project"
say "  ghcr owner   $ghcr_owner"
say "  domain       $domain"
say "  directory    $target_dir"
say "  template     ${REPO_SLUG}@${ref}"
say "  rename       $([ "$do_rename" -eq 1 ] && echo yes || echo 'no (--no-rename)')"
say "  boot         $([ "$do_boot" -eq 1 ] && echo yes || echo 'no (--no-boot)')"

if [ "$dry_run" -eq 1 ]; then
  say ""
  say "--dry-run: nothing was written."
  if [ "$json" -eq 1 ]; then
    printf '{"phase":"plan","status":"dry-run","project":"%s","dir":"%s"}\n' "$project" "$target_dir"
  fi
  exit 0
fi

# ------------------------------------------------- phase 1: preflight

phase 1 preflight

have() { command -v "$1" >/dev/null 2>&1; }

have git || die 3 "git is not installed" \
  "macOS: xcode-select --install" \
  "Debian/Ubuntu: sudo apt-get install -y git"

# gh is optional. With it the template relationship is created server-side
# and the new repo is owned by the caller; without it we clone and re-init.
use_gh=0
if have gh && gh auth status >/dev/null 2>&1; then
  use_gh=1
  say "  gh          authenticated, will create a repo from the template"
else
  if have gh; then
    say "  gh          installed but not authenticated, will clone instead"
    say "              run 'gh auth login' first to get a GitHub-hosted repo"
  else
    say "  gh          not installed, will clone instead"
  fi
fi

if [ "$do_boot" -eq 1 ]; then
  have docker || die 3 "docker is not installed, and --no-boot was not passed" \
    "install Docker Desktop: https://docs.docker.com/get-docker/" \
    "or scaffold without booting: rerun with --no-boot"

  docker compose version >/dev/null 2>&1 || die 3 "'docker compose' (v2) is not available" \
    "Compose v1 ('docker-compose') is not supported" \
    "upgrade Docker Desktop, or install the compose plugin: https://docs.docker.com/compose/install/"

  compose_version="$(docker compose version --short 2>/dev/null || echo unknown)"
  case "$compose_version" in
    1.*) die 3 "docker compose reports v${compose_version}, which is too old" \
           "BoringStack needs Compose v2 or newer" ;;
    *) say "  compose     v${compose_version}" ;;
  esac

  docker info >/dev/null 2>&1 || die 3 "the Docker daemon is not running" \
    "start Docker Desktop, or: sudo systemctl start docker" \
    "then rerun this installer"

  # Ports. The four core services always publish; the optional overlays
  # (observability, GlitchTip, Mailpit, bull-board) default on in dev, so
  # warn rather than fail for those.
  busy=""
  for port in $CORE_PORTS; do
    if have lsof && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      busy="$busy $port"
    elif ! have lsof && have nc && nc -z localhost "$port" >/dev/null 2>&1; then
      busy="$busy $port"
    fi
  done
  if [ -n "$busy" ]; then
    die 3 "port(s) already in use:${busy}" \
      "BoringStack needs 7330 (api), 7331 (ui), 5432 (postgres), 6379 (valkey)" \
      "free them, or find the owner with: lsof -nP -iTCP:${busy# } -sTCP:LISTEN"
  fi
  say "  ports       ${CORE_PORTS} free"

  optional_busy=""
  for port in 7332 8025 8055 3010 9090 9093; do
    if have lsof && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      optional_busy="$optional_busy $port"
    fi
  done
  if [ -n "$optional_busy" ]; then
    warn "optional-overlay port(s) in use:${optional_busy}"
    warn "  bull-board 7332, mailpit 8025, glitchtip 8055, grafana 3010, prometheus 9090, alertmanager 9093"
    warn "  disable the overlay in infra/compose/compose/.env with WITH_*=0, or free the port"
  fi

  # First boot builds images and runs migrations; the docs quote ~4 GB.
  mem_note=""
  if [ "$(uname -s)" = "Darwin" ] && have sysctl; then
    mem_total_gb=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 ))
    [ "$mem_total_gb" -gt 0 ] && mem_note="${mem_total_gb}GB total"
    if [ "$mem_total_gb" -gt 0 ] && [ "$mem_total_gb" -lt 8 ]; then
      warn "this machine has ${mem_total_gb}GB of RAM; the stack wants ~4GB free"
      warn "  trim the stack with WITH_OBSERVABILITY=0 WITH_GLITCHTIP=0 in compose/.env"
    fi
  elif [ -r /proc/meminfo ]; then
    mem_avail_gb=$(( $(awk '/MemAvailable/ {print $2; exit}' /proc/meminfo 2>/dev/null || echo 0) / 1048576 ))
    [ "$mem_avail_gb" -gt 0 ] && mem_note="${mem_avail_gb}GB available"
    if [ "$mem_avail_gb" -gt 0 ] && [ "$mem_avail_gb" -lt 4 ]; then
      warn "only ${mem_avail_gb}GB of RAM available; the stack wants ~4GB"
      warn "  trim the stack with WITH_OBSERVABILITY=0 WITH_GLITCHTIP=0 in compose/.env"
    fi
  fi
  [ -n "$mem_note" ] && say "  memory      $mem_note"
else
  say "  docker      skipped (--no-boot)"
fi

# Bun is not needed to boot — Compose runs every runtime — but it is needed
# to develop, so this is a warning and never a failure. See quickstart.
if have bun; then
  say "  bun         $(bun --version 2>/dev/null || echo present)"
else
  warn "bun is not installed"
  warn "  not needed to boot: Compose runs every runtime"
  warn "  needed to develop: 'bun run check', 'bun run regen', 'bun run rename:project'"
  warn "  install: curl -fsSL https://bun.sh/install | bash"
fi

if [ -e "$target_dir" ]; then
  if [ ! -d "$target_dir" ]; then
    die 3 "$target_dir exists and is not a directory" "pass a different --dir"
  fi
  if [ -n "$(ls -A "$target_dir" 2>/dev/null)" ] && [ "$force" -eq 0 ]; then
    die 3 "$target_dir is not empty" \
      "pass a different --dir, or --force to use it anyway"
  fi
fi

phase_ok

# -------------------------------------------------- phase 2: scaffold

phase 2 scaffold

if [ "$use_gh" -eq 1 ]; then
  # `gh repo create --clone` takes no directory argument: it always clones into
  # ./<name>. Let it, then move the result if --dir asked for somewhere else.
  say "  gh repo create $project --template $REPO_SLUG --private --clone"
  gh repo create "$project" --template "$REPO_SLUG" --private --clone >&2 \
  || die 4 "gh repo create failed" \
       "check 'gh auth status' and that the name '$project' is free in your account" \
       "or take the clone path instead: unset GH_TOKEN, or run 'gh auth logout'"

  if [ ! -d "$target_dir" ]; then
    [ -d "./$project" ] || die 4 "gh reported success but ./$project does not exist" \
      "clone it manually: gh repo clone $project $target_dir"
    mkdir -p "$(dirname "$target_dir")"
    mv "./$project" "$target_dir"
  fi
else
  say "  git clone --depth 1 --branch $ref $REPO_URL"
  git clone --depth 1 --branch "$ref" "$REPO_URL" "$target_dir" >&2 \
  || die 4 "git clone failed" \
       "check network access to github.com, and that the ref '$ref' exists" \
       "list refs with: git ls-remote --heads $REPO_URL"

  # Detach from upstream so this is the caller's project, not a fork. The
  # template path via gh does the same thing server-side.
  rm -rf "$target_dir/.git"
  ( cd "$target_dir" && git init -q && git add -A \
      && git -c user.email=installer@localhost -c user.name=installer \
           commit -qm "Initial commit from BoringStack ${ref}" ) >&2 2>/dev/null \
    || warn "could not create the initial commit; the tree is fine, just not committed"
  say "  detached from upstream; no fork relationship"
fi

[ -d "$target_dir" ] || die 4 "expected $target_dir to exist after scaffolding, but it does not"
[ -f "$target_dir/setup.sh" ] || die 4 "$target_dir does not look like BoringStack (no setup.sh)" \
  "the template layout may have changed; see $REPO_URL"

project_dir="$(cd "$target_dir" && pwd)"
say "  scaffolded into $project_dir"
phase_ok

# ---------------------------------------------------- phase 3: rename

phase 3 rename

if [ "$do_rename" -eq 0 ]; then
  say "  skipped (--no-rename); the tree keeps the BoringStack identifiers"
else
  [ -f "$project_dir/scripts/rename-project.sh" ] \
    || die 5 "scripts/rename-project.sh is missing from the scaffolded tree" \
         "rerun with --no-rename, then rebrand by hand"

  say "  ./scripts/rename-project.sh $project $ghcr_owner $domain"
  ( cd "$project_dir" && bash scripts/rename-project.sh "$project" "$ghcr_owner" "$domain" ) >&2 \
    || die 5 "rename-project.sh failed" \
         "the script is idempotent, so it is safe to rerun: cd $project_dir && bash scripts/rename-project.sh $project $ghcr_owner $domain" \
         "or preview the edits first with: DRY_RUN=1 bash scripts/rename-project.sh $project $ghcr_owner $domain"
  say "  renamed boringstack -> $project"
fi

phase_ok

# ------------------------------------------------------ phase 4: boot

phase 4 boot

if [ "$do_boot" -eq 0 ]; then
  say "  skipped (--no-boot)"
  phase_ok
  say ""
  say "Scaffolded. To boot it later:"
  say "  cd $project_dir && ./setup.sh --up"
  if [ "$json" -eq 1 ]; then
    printf '{"phase":"done","status":"ok","dir":"%s","booted":false}\n' "$project_dir"
  fi
  exit 0
fi

say "  ./setup.sh --up"
say "  first boot pulls images, builds api/ui and runs migrations; ~3 minutes"
( cd "$project_dir" && ./setup.sh --up ) >&2 \
  || die 6 "setup.sh --up failed" \
       "inspect the stack: cd $project_dir/infra/compose/compose && docker compose ps" \
       "read the logs: cd $project_dir/infra/compose/compose && docker compose logs --tail=100" \
       "setup.sh is idempotent, so it is safe to rerun"
phase_ok

# ---------------------------------------------------- phase 5: health

phase 5 health

# Poll rather than sleep-then-check: migrations and the Vite first build make
# readiness time vary a lot between a warm and a cold machine.
probe() {
  url="$1"
  if have curl; then
    curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null || echo 000
  elif have wget; then
    wget -q -O /dev/null --timeout=5 "$url" >/dev/null 2>&1 && echo 200 || echo 000
  else
    echo 000
  fi
}

wait_for() {
  url="$1"
  label="$2"
  attempt=0
  # 60 attempts x 5s = 5 minutes, generous enough for a cold first build.
  while [ "$attempt" -lt 60 ]; do
    code="$(probe "$url")"
    case "$code" in
      2*|3*) say "  $label  $code  $url"; return 0 ;;
    esac
    attempt=$((attempt + 1))
    sleep 5
  done
  say "  $label  timeout after 5m  $url"
  return 1
}

health_failed=0
wait_for "$HEALTH_UI" "ui " || health_failed=1
wait_for "$HEALTH_API" "api" || health_failed=1

if [ "$health_failed" -eq 1 ]; then
  say ""
  say "  container status:"
  ( cd "$project_dir/infra/compose/compose" && docker compose ps ) >&2 2>/dev/null || true
  say ""
  say "  recent logs:"
  ( cd "$project_dir/infra/compose/compose" && docker compose logs --tail=40 ) >&2 2>/dev/null || true
  die 7 "the stack booted but did not answer on HTTP" \
    "the containers may still be starting; retry: curl -i $HEALTH_UI" \
    "check logs: cd $project_dir/infra/compose/compose && docker compose logs -f"
fi

phase_ok

# ------------------------------------------------------------- summary

say ""
say "Ready."
say ""
say "  UI            http://localhost:7331"
say "  API           http://localhost:7330"
say "  OpenAPI       http://localhost:7330/swagger"
say ""
say "  cd $project_dir"
say ""
say "Sign up at http://localhost:7331 — signup is open in dev and the first"
say "user becomes the superuser. To seed one instead, set SUPERUSER_EMAIL and"
say "SUPERUSER_PASSWORD in infra/compose/compose/.env before the first boot."
say ""
say "Next:"
say "  agent guide   https://boringstack.xyz/agents.md"
say "  architecture  https://boringstack.xyz/architecture/why-boringstack/"
say "  the rules     https://boringstack.xyz/architecture/lint-as-contract/"
say "  bun run check  <- the oracle; run it before every commit"

if [ "$json" -eq 1 ]; then
  printf '{"phase":"done","status":"ok","dir":"%s","booted":true,"ui":"http://localhost:7331","api":"http://localhost:7330"}\n' "$project_dir"
fi
