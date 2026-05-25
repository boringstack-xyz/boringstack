#!/usr/bin/env bash
# UFW (Uncomplicated Firewall) hardening for a single-host deployment
# behind Cloudflare. Restricts ingress on 80 + 443 to Cloudflare's IP
# ranges only — any direct hit from a non-Cloudflare IP is blocked.
#
# THIS IS AN EXAMPLE. READ BEFORE RUNNING.
#   - It resets your UFW config (with confirmation).
#   - It allows SSH on port 22 by default — change SSH_PORT below if you
#     run SSH on a non-standard port.
#   - It is NOT idempotent across Cloudflare IP-range changes: re-run it
#     after Cloudflare publishes new ranges (rare; semi-annual).
#
# Tested on Ubuntu 22.04+ / Debian 12+. Requires: ufw, curl.

set -euo pipefail

SSH_PORT="${SSH_PORT:-22}"
CONFIRM="${CONFIRM:-}"

if [[ "$CONFIRM" != "yes" ]]; then
  cat <<EOF
This script will:
  1. Reset UFW to a clean state (deletes existing rules).
  2. Default deny incoming, allow outgoing.
  3. Allow SSH on port ${SSH_PORT}/tcp (from anywhere).
  4. Allow 80/tcp + 443/tcp ONLY from Cloudflare IP ranges
     (https://www.cloudflare.com/ips-v4 + /ips-v6).
  5. Enable UFW.

After this runs, all non-Cloudflare HTTP/HTTPS traffic is dropped.
Make sure your DNS is already behind Cloudflare with proxy enabled
(orange cloud) BEFORE running this on a production host.

Re-run with CONFIRM=yes to proceed:
  CONFIRM=yes $0
EOF
  exit 0
fi

command -v ufw >/dev/null || { echo "ufw not installed; apt install ufw" >&2; exit 1; }
command -v curl >/dev/null || { echo "curl not installed" >&2; exit 1; }

echo "[ufw] Resetting…"
ufw --force reset

echo "[ufw] Default policies: deny in / allow out"
ufw default deny incoming
ufw default allow outgoing

echo "[ufw] Allow SSH on port ${SSH_PORT}"
ufw allow "${SSH_PORT}/tcp" comment "SSH"

echo "[ufw] Fetching Cloudflare IPs…"
cf_v4="$(curl -fsS https://www.cloudflare.com/ips-v4)"
cf_v6="$(curl -fsS https://www.cloudflare.com/ips-v6)"

for ip in $cf_v4 $cf_v6; do
  ufw allow proto tcp from "$ip" to any port 80 comment "Cloudflare HTTP"
  ufw allow proto tcp from "$ip" to any port 443 comment "Cloudflare HTTPS"
done

echo "[ufw] Enabling…"
ufw --force enable

echo "[ufw] Done. Status:"
ufw status verbose
