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

# Byte collation, not the caller's locale. Under en_US.UTF-8 (and most other
# non-C locales) a `case` range like [a-z] collates as aAbBcC..., so it MATCHES
# uppercase: `--project ACME` and `--domain ACME.com` both passed validation and
# then failed in scripts/rename-project.sh, whose regexes are lowercase-only,
# after the GitHub repository already existed. Every range check below depends
# on this line.
LC_ALL=C
export LC_ALL

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

# These mirror scripts/rename-project.sh exactly. Validating loosely here meant
# a name like "a", "1acme" or a 40-character string passed preflight, created a
# real GitHub repository, and only then failed in phase 3.
#
#   project     ^[a-z][a-z0-9-]{1,30}$
#   ghcr owner  ^[A-Za-z0-9-]+$
#   domain      a dotted lowercase hostname
#
# Keep them in step: a mismatch is a failure after a remote side effect.
suggest_name() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-' \
    | tr -s '-' | sed 's/^[^a-z]*//; s/-$//' | cut -c1-31
}

case "$project" in
  *[!a-z0-9-]*)
    die 2 "project name '$project' may contain only lowercase letters, digits and dashes" \
      "it becomes npm package names, Docker container names and GHCR image tags" \
      "try: --project $(suggest_name "$project")" ;;
esac
case "$project" in
  [!a-z]*)
    die 2 "project name '$project' must start with a lowercase letter" \
      "npm package names and Docker container names cannot start with a digit or dash" \
      "try: --project $(suggest_name "$project")" ;;
esac
# Deliberately stricter than the renamer here, which allows a trailing dash.
# The renamer derives image names as <project>-api, so "acme-" produces
# "acme--api", and GHCR permits only a single separator between alphanumeric
# runs, making that an invalid image name. Rejecting costs exit 2 before any
# side effect; allowing it costs a broken registry push later.
case "$project" in
  *-) die 2 "project name '$project' cannot end with a dash" \
        "the renamer derives <project>-api, so this would give 'acme--api'" \
        "GHCR rejects a double separator in an image name" ;;
esac
project_len=${#project}
if [ "$project_len" -lt 2 ] || [ "$project_len" -gt 31 ]; then
  die 2 "project name '$project' is $project_len characters; it must be 2 to 31" \
    "scripts/rename-project.sh enforces the same bound and would fail after the repo exists"
fi

[ -n "$ghcr_owner" ] || ghcr_owner="$project"
[ -n "$domain" ] || domain="${project}.com"
[ -n "$target_dir" ] || target_dir="./${project}"

case "$ghcr_owner" in
  *[!A-Za-z0-9-]*)
    die 2 "ghcr owner '$ghcr_owner' may contain only letters, digits and dashes" \
      "this is the GitHub account or org that owns the container images" ;;
esac

# Reject anything that would need escaping in the --json output, and anything
# a shell would reinterpret. Cheaper than quoting correctly everywhere.
case "$target_dir" in
  *[!A-Za-z0-9._/-]*)
    die 2 "--dir '$target_dir' may contain only letters, digits, dot, underscore, dash and slash" \
      "paths outside that set break the --json output and need shell quoting" ;;
esac

# The domain is only cosmetic here (it seeds the noreply@ and demo@ mailboxes),
# but the renamer rejects a malformed one, so it has to be caught before the
# repo exists. Matching the renamer means matching it per label:
#
#   ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$
#
# Every label must start AND end alphanumeric. A charset-plus-shape check on the
# whole string is not equivalent: it accepts "acme-.com", whose first label ends
# in a dash, and that failed in phase 3 after the repository already existed.
domain_reject() {
  die 2 "domain '$domain' is not a valid hostname: $1" \
    "each dot-separated label must start and end with a letter or digit" \
    "example: --domain acme.com"
}

case "$domain" in
  *[!a-z0-9.-]*) domain_reject "only lowercase letters, digits, dots and dashes" ;;
  *.*) : ;;
  *) domain_reject "it needs at least one dot" ;;
esac

# Walk the labels. Setting IFS for the split is why this is a subshell-free
# loop over $domain with IFS restored straight after.
domain_old_ifs="$IFS"
IFS='.'
# shellcheck disable=SC2086  # deliberate word split on IFS to walk the labels
set -- $domain
IFS="$domain_old_ifs"
[ $# -ge 2 ] || domain_reject "it needs at least one dot"
for label in "$@"; do
  [ -n "$label" ] || domain_reject "it has an empty label"
  case "$label" in
    -* | *-) domain_reject "label '$label' starts or ends with a dash" ;;
  esac
done

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
# `gh repo create --template` always copies the template's default branch;
# there is no way to ask it for another ref. Rather than accept --ref and
# silently ignore it, fall back to the clone path, which honours it.
use_gh=0
if [ "$ref" != "$DEFAULT_REF" ]; then
  say "  gh          skipped: --ref $ref cannot be used with a template create"
  say "              cloning instead so the ref is honoured"
elif have gh && gh auth status >/dev/null 2>&1; then
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

# Clone into a staging directory beside --dir, then move the tree in. Never
# touch what is already in --dir.
#
# An earlier version cloned straight into --dir and emptied it first, so that a
# retry would not hit "already exists and is not an empty directory". With
# --force on a non-empty destination that deleted the caller's files *before*
# the clone was known to succeed, and a failed clone left them gone. --force
# means "proceed into a directory that has contents", not "erase them".
#
# Staging beside the destination rather than in $TMPDIR keeps the move on one
# filesystem, so it is a rename rather than a copy, and it sidesteps the race an
# even earlier version hit when tar read .git while git was still writing it.
parent_dir="$(dirname "$target_dir")"
mkdir -p "$parent_dir" || die 4 "could not create $parent_dir"
staging="$parent_dir/.boringstack-install.$$"
rm -rf "$staging"
# Only ever removes the staging directory, which belongs to this run.
trap 'rm -rf "$staging"' EXIT INT TERM

if [ "$use_gh" -eq 1 ]; then
  # `gh repo create --clone` always lands in ./<name> with no way to redirect
  # it, so create and clone are separate steps and the clone gets the path.
  say "  gh repo create $project --template $REPO_SLUG --private"
  gh repo create "$project" --template "$REPO_SLUG" --private >&2 \
  || die 4 "gh repo create failed" \
       "check 'gh auth status' and that the name '$project' is free in your account" \
       "or take the clone path instead: run 'gh auth logout', or unset GH_TOKEN"

  # A template copy is not instant server-side. The clone can 404, but it can
  # also SUCCEED against a repository GitHub has created and not yet populated,
  # printing "you appear to have cloned an empty repository" and exiting 0. So
  # the retry condition is "the tree arrived", not "the command worked".
  attempt=0
  while : ; do
    rm -rf "$staging"
    if gh repo clone "$project" "$staging" >&2 && [ -f "$staging/setup.sh" ]; then
      break
    fi
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 8 ]; then
      die 4 "created $project but its contents never arrived after 8 attempts" \
        "the repository exists, so do not rerun this installer" \
        "GitHub may still be copying the template; wait, then:" \
        "  gh repo clone $project $target_dir"
    fi
    say "  template contents not ready yet, retrying ($attempt/8)"
    sleep 3
  done
else
  say "  git clone --depth 1 --branch $ref $REPO_URL"
  git clone --depth 1 --branch "$ref" "$REPO_URL" "$staging" >&2 \
  || die 4 "git clone failed" \
       "check network access to github.com, and that the ref '$ref' exists" \
       "list refs with: git ls-remote --heads $REPO_URL"

  # Detach from upstream so this is the caller's project, not a fork. The
  # template path via gh does the same thing server-side. Done here, before the
  # move, so nothing writes into .git while the tree is being relocated.
  rm -rf "$staging/.git"
  ( cd "$staging" \
      && git init -q \
      && git add -A \
      && git -c user.email=installer@localhost -c user.name=installer \
           commit -qm "Initial commit from BoringStack ${ref}" ) >&2 \
    || warn "could not create the initial commit; the tree is fine, just not committed"
  say "  detached from upstream; no fork relationship"
fi

[ -f "$staging/setup.sh" ] || die 4 "the clone does not look like BoringStack (no setup.sh)" \
  "the template layout may have changed; see $REPO_URL"

# Move the tree in. The three globs cover dotfiles (.github, .git, .tsforge),
# which a bare * would skip; each is guarded because an unmatched glob stays
# literal in sh.
mkdir -p "$target_dir" || die 4 "could not create $target_dir"
for entry in "$staging"/* "$staging"/.[!.]* "$staging"/..?*; do
  [ -e "$entry" ] || continue
  base="${entry##*/}"
  if [ -e "$target_dir/$base" ]; then
    # Only reachable with --force, since preflight refuses a non-empty --dir
    # otherwise. Say what is being replaced rather than doing it silently.
    warn "replacing existing $target_dir/$base"
    # ${var:?} so an empty expansion aborts instead of becoming `rm -rf /`.
    rm -rf "${target_dir:?}/${base:?}"
  fi
  mv "$entry" "$target_dir/$base" \
    || die 4 "could not move $base into $target_dir" \
         "the clone is at $staging until this shell exits"
done
rm -rf "$staging"

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
  # Deliberately NOT dumping `docker compose logs`: container logs echo the
  # environment on boot, so printing them into a terminal, a CI log or an
  # agent transcript leaks whatever is in compose/.env. Name the command and
  # let the reader run it where they can see it.
  die 7 "the stack booted but did not answer on HTTP" \
    "the containers may still be starting; retry: curl -i $HEALTH_UI" \
    "read the logs yourself: cd $project_dir/infra/compose/compose && docker compose logs -f" \
    "logs are not printed here because they echo the environment on boot"
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
say "Sign up at http://localhost:7331. Signup is open in dev, and it makes you"
say "the owner of your own account. It does NOT make you a platform admin:"
say "registration leaves is_platform_admin false. For that, set SUPERUSER_EMAIL"
say "and SUPERUSER_PASSWORD in infra/compose/compose/.env and reboot, which runs"
say "the seed that sets the flag."
say ""
say "Next:"
say "  agent guide   https://boringstack.xyz/agents.md"
say "  architecture  https://boringstack.xyz/architecture/why-boringstack/"
say "  the rules     https://boringstack.xyz/architecture/lint-as-contract/"
say "  bun run check  <- the oracle; run it before every commit"

if [ "$json" -eq 1 ]; then
  printf '{"phase":"done","status":"ok","dir":"%s","booted":true,"ui":"http://localhost:7331","api":"http://localhost:7330"}\n' "$project_dir"
fi
