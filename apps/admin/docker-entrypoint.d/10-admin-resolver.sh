#!/bin/sh
# Runs before nginx starts (official nginx image entrypoint). nginx resolves a
# literal proxy_pass hostname at startup, so the dashboard would refuse to start
# until the admin API is up. A variable upstream plus the cluster or Docker DNS
# resolver, read from resolv.conf here, defers that lookup to request time.
set -eu

OUT=/tmp/nginx/resolver.conf
NS="$(awk '/^nameserver/ {print $2; exit}' /etc/resolv.conf 2>/dev/null || true)"

[ -n "$NS" ] || NS="127.0.0.11"

mkdir -p /tmp/nginx
printf 'resolver %s valid=10s ipv6=off;\n' "$NS" > "$OUT"
